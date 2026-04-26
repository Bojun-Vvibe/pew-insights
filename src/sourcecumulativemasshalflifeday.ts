/**
 * source-cumulative-mass-half-life-day: for each source, the smallest
 * number of UTC calendar days (sorted descending by per-day token mass)
 * needed for the cumulative share to first reach the 50% mark
 * (`halfLifeDays`). Also reports `quartileLifeDays` (>= 25%) and
 * `threeQuarterLifeDays` (>= 75%) for the same sorted-descending day
 * sequence, plus the cumulative share captured by the top-1 and top-3
 * days as quick reference points.
 *
 * Headline question: **how many of a source's biggest UTC days do you
 * have to add together before you've explained half of its history?**
 * A source whose mass piles onto a small handful of days has a tiny
 * `halfLifeDays`; a source with uniform-ish mass across many days has
 * `halfLifeDays` close to `daysActive / 2`.
 *
 * Why this is orthogonal to every prior lens (must remain orthogonal
 * to keep the family budget honest):
 *
 *   - `source-single-day-mass-concentration` reports `maxDayShare`,
 *     `top2Share`, `top3Share`, `hhi`. Those are **fixed-k** shares
 *     (k=1, 2, 3) and a sum-of-squares index. This metric inverts
 *     the question: instead of "what share does the top-k take?",
 *     it asks "what's the smallest k that crosses a target share?".
 *     Two sources can have identical `top3Share` but radically
 *     different `halfLifeDays` (e.g. one source needs 2 days to
 *     reach 50%, another needs 7).
 *   - `daily-token-gini-coefficient` is a **global** (all-source-
 *     pooled) inequality measure on per-day total mass. It cannot
 *     answer the per-source question and conflates "one source had
 *     a big day" with "one calendar day was hot across all sources".
 *   - `source-decay-half-life` (if present) is about a different
 *     kind of half-life — recency / decay over chronologically
 *     ordered days, not a half-life in cumulative-mass-on-sorted-
 *     days. Sorting by mass descending strips out chronology
 *     entirely; this metric is shape-only.
 *   - `cumulative-tokens-midpoint` reports a single global
 *     midpoint timestamp on a chronological cumulative curve;
 *     this is per-source and on a mass-sorted curve.
 *   - `source-day-of-week-token-mass-share`, `source-hour-of-day-*`,
 *     `source-active-hour-*`, `source-burstiness-fano-factor`:
 *     all measure either modular calendar location, hour-grain
 *     burstiness, or run length. None compute a cumulative-share
 *     threshold-crossing index over sorted-descending day mass.
 *
 * Concretely, for each surviving source we compute:
 *
 *   - daysActive:           distinct UTC calendar days with positive
 *                           total_tokens within the window.
 *   - tokenSum:             sum of total_tokens across kept rows.
 *   - quartileLifeDays:     smallest k in [1, daysActive] s.t.
 *                           sum of top-k days' tokens / tokenSum
 *                           >= 0.25.
 *   - halfLifeDays:         same with threshold 0.50.
 *   - threeQuarterLifeDays: same with threshold 0.75.
 *   - top1Share:            top-1 day cumulative share (== maxDayShare).
 *   - top3Share:            top-3 cumulative share (capped at sum).
 *   - halfLifeRatio:        halfLifeDays / daysActive, in
 *                           (0, 1]. A perfectly flat source
 *                           gives ratio ~ 0.5; a single-day source
 *                           gives ratio 1.0; a heavy-headed source
 *                           gives ratio close to 1/daysActive.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite hour_start.
 *   3. Per-source: bucket each row's total_tokens (treated as 0 if
 *      non-finite or non-positive) into a per-UTC-day map keyed by
 *      `YYYY-MM-DD` (first 10 chars of ISO hour_start).
 *   4. Sort each source's per-day token list descending; tiebreak by
 *      day asc for determinism.
 *   5. Walk the sorted list, accumulating share; record the first
 *      index k where cum_share >= 0.25, 0.50, 0.75 (1-indexed).
 *      Because shares are non-decreasing, the threshold crossings
 *      happen monotonically and a single pass suffices.
 *   6. Apply display gates `--min-days` (default 2 — half-life is
 *      degenerate at 1 day), then sort, then optionally `--top` cap.
 *
 * Edge cases:
 *
 *   - tokenSum == 0          ->  source dropped. droppedZeroMass.
 *   - daysActive == 1        ->  all three lifeDays = 1, all shares
 *                                = 1.0, halfLifeRatio = 1.0.
 *                                Default min-days = 2 hides these
 *                                from the table.
 *   - threshold never crossed (cannot happen by construction since
 *     last cum_share = 1.0): defensively, lifeDays = daysActive.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort is deterministic with `source` asc as the final tiebreak.
 */
import type { QueueLine } from './types.js';

export interface SourceCumulativeMassHalfLifeDayOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many active calendar days.
   * Display filter only — global denominators reflect the full
   * kept population. Suppressed rows surface as
   * `droppedBelowMinDays`. Must be a positive integer. Default
   * 2 (half-life is degenerate at 1 day).
   */
  minDays?: number;
  /**
   * Drop sources whose `halfLifeRatio` is strictly above this
   * value from the per-source table. Display filter only — used
   * to surface only sources whose mass is *concentrated on few
   * days*. Suppressed rows surface as
   * `droppedAboveMaxHalfLifeRatio`. Must be in (0, 1]. Default
   * 1 = no filter (all surviving rows pass).
   */
  maxHalfLifeRatio?: number;
  /**
   * Drop sources whose absolute `halfLifeDays` is strictly above
   * this value from the per-source table. Display filter only.
   * Suppressed rows surface as `droppedAboveMaxHalfLifeDays`.
   * Must be a positive integer. Default null = no filter.
   *
   * Composes orthogonally with `--max-half-ratio`: the absolute
   * gate fires on raw day count (e.g. "show only sources whose
   * top-2 days clear 50%"), while the ratio gate fires on
   * normalised concentration (e.g. "show only sources whose
   * half-life is < 30% of their active history"). A long-tail
   * source can pass the ratio gate but fail the absolute gate
   * (and vice versa).
   */
  maxHalfLifeDays?: number | null;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default
   * null = no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'half'   (default): halfLifeDays asc (smallest k = most concentrated first).
   *   - 'ratio':            halfLifeRatio asc (most concentrated first).
   *   - 'tokens':           tokenSum desc.
   *   - 'days':             daysActive desc.
   *   - 'quartile':         quartileLifeDays asc.
   *   - 'threequarter':     threeQuarterLifeDays asc.
   *   - 'source':           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'half'
    | 'ratio'
    | 'tokens'
    | 'days'
    | 'quartile'
    | 'threequarter'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceCumulativeMassHalfLifeDayRow {
  source: string;
  daysActive: number;
  tokenSum: number;
  /** smallest k s.t. sum of top-k days >= 25% of tokenSum */
  quartileLifeDays: number;
  /** smallest k s.t. sum of top-k days >= 50% of tokenSum */
  halfLifeDays: number;
  /** smallest k s.t. sum of top-k days >= 75% of tokenSum */
  threeQuarterLifeDays: number;
  /** top-1 day share (== maxDayShare) */
  top1Share: number;
  /** top-3 cumulative share (capped at 1 if daysActive < 3) */
  top3Share: number;
  /** halfLifeDays / daysActive, in (0, 1] */
  halfLifeRatio: number;
}

export interface SourceCumulativeMassHalfLifeDayReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minDays: number;
  maxHalfLifeRatio: number;
  maxHalfLifeDays: number | null;
  top: number | null;
  sort:
    | 'half'
    | 'ratio'
    | 'tokens'
    | 'days'
    | 'quartile'
    | 'threequarter'
    | 'source';
  /** Distinct sources seen pre-filter. */
  totalSources: number;
  /** Sum of total_tokens across all kept rows. */
  totalTokens: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedZeroMass: number;
  droppedBelowMinDays: number;
  droppedAboveMaxHalfLifeRatio: number;
  droppedAboveMaxHalfLifeDays: number;
  droppedBelowTopCap: number;
  sources: SourceCumulativeMassHalfLifeDayRow[];
}

const VALID_SORTS: SourceCumulativeMassHalfLifeDayOptions['sort'][] = [
  'half',
  'ratio',
  'tokens',
  'days',
  'quartile',
  'threequarter',
  'source',
];

export function buildSourceCumulativeMassHalfLifeDay(
  queue: QueueLine[],
  opts: SourceCumulativeMassHalfLifeDayOptions = {},
): SourceCumulativeMassHalfLifeDayReport {
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 1) {
    throw new Error(
      `minDays must be a positive integer (got ${opts.minDays})`,
    );
  }
  const maxHalfLifeRatio = opts.maxHalfLifeRatio ?? 1;
  if (
    !Number.isFinite(maxHalfLifeRatio) ||
    maxHalfLifeRatio <= 0 ||
    maxHalfLifeRatio > 1
  ) {
    throw new Error(
      `maxHalfLifeRatio must be a finite number in (0, 1] (got ${opts.maxHalfLifeRatio})`,
    );
  }
  const maxHalfLifeDays = opts.maxHalfLifeDays ?? null;
  if (maxHalfLifeDays !== null) {
    if (!Number.isInteger(maxHalfLifeDays) || maxHalfLifeDays < 1) {
      throw new Error(
        `maxHalfLifeDays must be a positive integer (got ${opts.maxHalfLifeDays})`,
      );
    }
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'half';
  if (!VALID_SORTS.includes(sort)) {
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

  const perSource = new Map<string, Map<string, number>>();

  let droppedInvalidHourStart = 0;
  let droppedSourceFilter = 0;
  let totalTokens = 0;

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

    const totRaw = Number(q.total_tokens);
    const tot = Number.isFinite(totRaw) && totRaw > 0 ? totRaw : 0;
    if (tot === 0) continue;

    const day = q.hour_start.slice(0, 10);

    let m = perSource.get(source);
    if (!m) {
      m = new Map<string, number>();
      perSource.set(source, m);
    }
    m.set(day, (m.get(day) ?? 0) + tot);
    totalTokens += tot;
  }

  const totalSources = perSource.size;
  let droppedZeroMass = 0;
  const allRows: SourceCumulativeMassHalfLifeDayRow[] = [];

  for (const [source, dayMap] of perSource.entries()) {
    let sum = 0;
    const dayEntries: Array<[string, number]> = [];
    for (const [d, t] of dayMap.entries()) {
      if (t <= 0) continue;
      dayEntries.push([d, t]);
      sum += t;
    }
    if (dayEntries.length === 0 || sum === 0) {
      droppedZeroMass += 1;
      continue;
    }
    // Sort descending by tokens; tiebreak by day asc for determinism.
    dayEntries.sort((a, b) => {
      const d = b[1] - a[1];
      if (d !== 0) return d;
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });

    const daysActive = dayEntries.length;

    // Single pass: find smallest k where cumshare >= 0.25, 0.50, 0.75.
    let cum = 0;
    let qLife = 0;
    let hLife = 0;
    let tqLife = 0;
    for (let i = 0; i < daysActive; i++) {
      cum += dayEntries[i]![1];
      const share = cum / sum;
      if (qLife === 0 && share >= 0.25) qLife = i + 1;
      if (hLife === 0 && share >= 0.5) hLife = i + 1;
      if (tqLife === 0 && share >= 0.75) tqLife = i + 1;
    }
    // Defensive: cum must equal sum at the last step, so all three
    // are set. Belt-and-braces:
    if (qLife === 0) qLife = daysActive;
    if (hLife === 0) hLife = daysActive;
    if (tqLife === 0) tqLife = daysActive;

    const top1Share = dayEntries[0]![1] / sum;
    const top3Tokens =
      daysActive >= 3
        ? dayEntries[0]![1] + dayEntries[1]![1] + dayEntries[2]![1]
        : daysActive === 2
          ? dayEntries[0]![1] + dayEntries[1]![1]
          : dayEntries[0]![1];
    const top3Share = top3Tokens / sum;
    const halfLifeRatio = hLife / daysActive;

    allRows.push({
      source,
      daysActive,
      tokenSum: sum,
      quartileLifeDays: qLife,
      halfLifeDays: hLife,
      threeQuarterLifeDays: tqLife,
      top1Share,
      top3Share,
      halfLifeRatio,
    });
  }

  let droppedBelowMinDays = 0;
  let droppedAboveMaxHalfLifeRatio = 0;
  let droppedAboveMaxHalfLifeDays = 0;
  const survived: SourceCumulativeMassHalfLifeDayRow[] = [];
  for (const row of allRows) {
    if (row.daysActive < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }
    if (row.halfLifeRatio > maxHalfLifeRatio) {
      droppedAboveMaxHalfLifeRatio += 1;
      continue;
    }
    if (maxHalfLifeDays !== null && row.halfLifeDays > maxHalfLifeDays) {
      droppedAboveMaxHalfLifeDays += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'half') primary = a.halfLifeDays - b.halfLifeDays;
    else if (sort === 'ratio') primary = a.halfLifeRatio - b.halfLifeRatio;
    else if (sort === 'tokens') primary = b.tokenSum - a.tokenSum;
    else if (sort === 'days') primary = b.daysActive - a.daysActive;
    else if (sort === 'quartile')
      primary = a.quartileLifeDays - b.quartileLifeDays;
    else if (sort === 'threequarter')
      primary = a.threeQuarterLifeDays - b.threeQuarterLifeDays;
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
    minDays,
    maxHalfLifeRatio,
    maxHalfLifeDays,
    top,
    sort,
    totalSources,
    totalTokens,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedZeroMass,
    droppedBelowMinDays,
    droppedAboveMaxHalfLifeRatio,
    droppedAboveMaxHalfLifeDays,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
