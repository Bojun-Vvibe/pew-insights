/**
 * source-debut-recency: where on the calendar did each source's
 * tokens land — and how much of the corpus is "still in its
 * debut window" vs "long-entrenched"?
 *
 * For every source we compute, on its own tokens-bearing buckets:
 *
 *   - firstSeen / lastSeen: ISO of first / last active bucket.
 *   - tenureHours: clock hours firstSeen → lastSeen (0 if a single
 *     bucket).
 *   - daysSinceDebut: clock hours from firstSeen to the corpus
 *     end (`asOf`, defaults to the latest hour_start across the
 *     entire kept window) divided by 24. Higher = older debut.
 *   - daysSinceLastSeen: clock hours from lastSeen to `asOf`,
 *     divided by 24. 0 if the source is still active in the final
 *     hour. Higher = source has gone quiet.
 *   - tokens: sum of total_tokens for the source.
 *   - debutWindowTokens: tokens emitted in the source's
 *     **first `debutWindowFraction` of its own tenure** (default
 *     0.25 — i.e., the first quarter of its life). Single-bucket
 *     sources collapse to debutWindowTokens == tokens.
 *   - debutShare: debutWindowTokens / tokens, in [0, 1]. 1 means
 *     the source unloaded everything in its first quarter and went
 *     quiet; values near `debutWindowFraction` mean the source
 *     emits at a roughly flat rate.
 *
 * Globally we also surface a `newcomerRollup`:
 *
 *   - newcomerWindowDays: echo of the resolved `--newcomer-window-days`
 *     (default 7).
 *   - newcomerCutoffIso: `asOf` minus `newcomerWindowDays` days.
 *   - newcomerSources: count of sources whose `firstSeen >= cutoff`.
 *   - newcomerTokens: sum of `tokens` for those sources.
 *   - newcomerTokenShare: newcomerTokens / totalTokens (0 if total is 0).
 *
 * Why a separate subcommand:
 *
 *   - `source-tenure` reports first/last/span but has no notion of
 *     "newcomer" vs "long-entrenched" relative to the corpus end,
 *     and no per-source debut-window mass concentration.
 *   - `source-decay-half-life` measures the *intra-tenure* shape
 *     (where in a source's own life mass piled up) — orthogonal to
 *     where the source's life *sits on the calendar*.
 *   - `source-mix` and `source-rank-churn` are leaderboards over
 *     mass / rank; neither asks how recently each source debuted.
 *   - `source-decay-half-life`'s `halfLifeFraction` is a 50% mark on
 *     the same axis but *per source* and at a fixed quantile;
 *     `debutShare` is a fixed-window mass fraction with the window
 *     anchored to the source's own debut.
 *
 * Headline question: "How much of my recent token spend is coming
 * from sources that debuted in the last week, vs from sources I've
 * been using for months?" — and within each source, "did it
 * front-load its first quarter and go quiet, or is it pacing
 * evenly?"
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * The corpus end (`asOf`) is derived from the data — never from
 * Date.now() — so identical input yields identical output.
 */
import type { QueueLine } from './types.js';

export interface SourceDebutRecencyOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single normalised model. Non-matching rows -> droppedModelFilter. */
  model?: string | null;
  /**
   * Drop sources whose distinct active buckets is below this
   * threshold from `sources[]`. Display filter only — global
   * denominators (totalSources, totalTokens, newcomerRollup) reflect
   * the full population. Suppressed rows surface as
   * `droppedSparseSources`. Default 0 = keep every source.
   */
  minBuckets?: number;
  /**
   * Cap the number of `sources[]` rows emitted after sorting and
   * the `minBuckets` floor. Suppressed rows surface as
   * `droppedBelowTopCap`. Default null = no cap. The newcomer
   * rollup is unaffected by this cap.
   */
  top?: number | null;
  /**
   * Drop sources whose `debutShare` is strictly below this
   * threshold from `sources[]`. Display filter only — global
   * denominators (totalSources, totalTokens, newcomerRollup) reflect
   * the full population. Suppressed rows surface as
   * `droppedBelowDebutShareMin`. Must be in `[0, 1]`. Default 0 = no floor.
   */
  debutShareMin?: number;
  /**
   * Sort key for `sources[]`:
   *   - 'recency' (default): daysSinceDebut asc (newest debuts
   *     first; ties on tokens desc, source asc).
   *   - 'tokens':            tokens desc (highest mass first).
   *   - 'tenure':            tenureHours desc (longest-lived first).
   *   - 'debutshare':        debutShare desc (most front-loaded
   *     first within its own tenure window).
   *   - 'idle':              daysSinceLastSeen desc (most-quiet first).
   * Final tiebreak in all cases: source key asc (lex).
   */
  sort?: 'recency' | 'tokens' | 'tenure' | 'debutshare' | 'idle';
  /**
   * Fraction of each source's tenure used as its "debut window"
   * for `debutWindowTokens`. Must be in `(0, 1]`. Default 0.25.
   */
  debutWindowFraction?: number;
  /**
   * Days of the corpus end to count as the "newcomer" cohort for
   * the global newcomer rollup. Must be > 0. Default 7.
   */
  newcomerWindowDays?: number;
  /**
   * Override the corpus-end anchor (`asOf`). When null/omitted,
   * defaults to the latest `hour_start` across the kept window.
   * Useful for tests; in production callers should leave it unset.
   */
  asOf?: string | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceDebutRecencyRow {
  source: string;
  firstSeen: string;
  lastSeen: string;
  tenureHours: number;
  activeBuckets: number;
  tokens: number;
  daysSinceDebut: number;
  daysSinceLastSeen: number;
  debutWindowTokens: number;
  debutShare: number;
}

export interface SourceDebutRecencyNewcomerRollup {
  newcomerWindowDays: number;
  newcomerCutoffIso: string | null;
  newcomerSources: number;
  newcomerTokens: number;
  newcomerTokenShare: number;
}

export interface SourceDebutRecencyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  model: string | null;
  asOf: string | null;
  debutWindowFraction: number;
  /** Echo of the resolved `minBuckets` floor. */
  minBuckets: number;
  /** Echo of the resolved `top` cap (null = no cap). */
  top: number | null;
  /** Echo of the resolved `sort` key. */
  sort: 'recency' | 'tokens' | 'tenure' | 'debutshare' | 'idle';
  /** Distinct sources surviving filters (pre min-buckets filter). */
  totalSources: number;
  /** Sum of total_tokens across the *full* surviving population. */
  totalTokens: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `model` filter. */
  droppedModelFilter: number;
  /** Source rows hidden by the `minBuckets` floor. */
  droppedSparseSources: number;
  /** Source rows hidden by the `debutShareMin` floor. */
  droppedBelowDebutShareMin: number;
  /** Echo of the resolved `debutShareMin` floor. */
  debutShareMin: number;
  /** Source rows trimmed by the `top` cap (after sort + floor). */
  droppedBelowTopCap: number;
  /** Global newcomer rollup (always over the full kept population). */
  newcomerRollup: SourceDebutRecencyNewcomerRollup;
  /** Per-source rows, sorted per opts.sort. */
  sources: SourceDebutRecencyRow[];
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function buildSourceDebutRecency(
  queue: QueueLine[],
  opts: SourceDebutRecencyOptions = {},
): SourceDebutRecencyReport {
  const minBuckets = opts.minBuckets ?? 0;
  if (!Number.isInteger(minBuckets) || minBuckets < 0) {
    throw new Error(
      `minBuckets must be a non-negative integer (got ${opts.minBuckets})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'recency';
  if (
    sort !== 'recency' &&
    sort !== 'tokens' &&
    sort !== 'tenure' &&
    sort !== 'debutshare' &&
    sort !== 'idle'
  ) {
    throw new Error(
      `sort must be 'recency' | 'tokens' | 'tenure' | 'debutshare' | 'idle' (got ${opts.sort})`,
    );
  }

  const debutWindowFraction = opts.debutWindowFraction ?? 0.25;
  if (
    !Number.isFinite(debutWindowFraction) ||
    debutWindowFraction <= 0 ||
    debutWindowFraction > 1
  ) {
    throw new Error(
      `debutWindowFraction must be in (0, 1] (got ${opts.debutWindowFraction})`,
    );
  }

  const newcomerWindowDays = opts.newcomerWindowDays ?? 7;
  if (!Number.isFinite(newcomerWindowDays) || newcomerWindowDays <= 0) {
    throw new Error(
      `newcomerWindowDays must be > 0 (got ${opts.newcomerWindowDays})`,
    );
  }

  const debutShareMin = opts.debutShareMin ?? 0;
  if (
    !Number.isFinite(debutShareMin) ||
    debutShareMin < 0 ||
    debutShareMin > 1
  ) {
    throw new Error(
      `debutShareMin must be in [0, 1] (got ${opts.debutShareMin})`,
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

  let asOfOverrideMs: number | null = null;
  if (opts.asOf != null) {
    const m = Date.parse(opts.asOf);
    if (!Number.isFinite(m)) throw new Error(`invalid asOf: ${opts.asOf}`);
    asOfOverrideMs = m;
  }

  const modelFilter =
    opts.model != null && opts.model !== '' ? opts.model : null;

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  interface Acc {
    bucketMs: Map<number, { iso: string; tokens: number }>;
  }
  const perSource = new Map<string, Acc>();

  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedModelFilter = 0;
  let maxKeptMs = -Infinity;
  let maxKeptIso: string | null = null;

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

    if (modelFilter !== null) {
      const model = typeof q.model === 'string' ? q.model : '';
      if (model !== modelFilter) {
        droppedModelFilter += 1;
        continue;
      }
    }

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';

    let acc = perSource.get(source);
    if (!acc) {
      acc = { bucketMs: new Map<number, { iso: string; tokens: number }>() };
      perSource.set(source, acc);
    }
    const cell = acc.bucketMs.get(ms);
    if (cell) {
      cell.tokens += tt;
    } else {
      acc.bucketMs.set(ms, { iso: q.hour_start, tokens: tt });
    }

    if (ms > maxKeptMs) {
      maxKeptMs = ms;
      maxKeptIso = q.hour_start;
    }
  }

  const asOfMs = asOfOverrideMs !== null ? asOfOverrideMs : maxKeptMs;
  const asOfIso =
    asOfOverrideMs !== null ? opts.asOf! : maxKeptIso;

  const allRows: SourceDebutRecencyRow[] = [];
  let droppedSparseSources = 0;
  let totalTokens = 0;

  for (const [source, acc] of perSource.entries()) {
    const sorted = [...acc.bucketMs.entries()].sort((a, b) => a[0] - b[0]);
    const activeBuckets = sorted.length;
    if (activeBuckets === 0) continue;

    let srcTokens = 0;
    for (const [, cell] of sorted) srcTokens += cell.tokens;
    totalTokens += srcTokens;

    const firstMs = sorted[0]![0];
    const lastMs = sorted[sorted.length - 1]![0];
    const firstIso = sorted[0]![1].iso;
    const lastIso = sorted[sorted.length - 1]![1].iso;
    const tenureMs = lastMs - firstMs;
    const tenureHours = tenureMs / HOUR_MS;

    // Debut window: first `debutWindowFraction` of the source's
    // own tenure. For a single-bucket source the window collapses
    // to that one bucket and debutWindowTokens == tokens.
    let debutWindowTokens = 0;
    if (tenureMs <= 0) {
      debutWindowTokens = srcTokens;
    } else {
      const windowEndMs = firstMs + tenureMs * debutWindowFraction;
      for (const [ms, cell] of sorted) {
        if (ms <= windowEndMs) debutWindowTokens += cell.tokens;
      }
    }
    const debutShare = srcTokens > 0 ? debutWindowTokens / srcTokens : 0;

    const daysSinceDebut =
      asOfMs !== -Infinity ? (asOfMs - firstMs) / DAY_MS : 0;
    const daysSinceLastSeen =
      asOfMs !== -Infinity ? (asOfMs - lastMs) / DAY_MS : 0;

    allRows.push({
      source,
      firstSeen: firstIso,
      lastSeen: lastIso,
      tenureHours,
      activeBuckets,
      tokens: srcTokens,
      daysSinceDebut,
      daysSinceLastSeen,
      debutWindowTokens,
      debutShare,
    });
  }

  // Newcomer rollup over the **full** allRows population
  // (regardless of minBuckets / top filters).
  let newcomerRollup: SourceDebutRecencyNewcomerRollup;
  if (asOfMs === -Infinity) {
    newcomerRollup = {
      newcomerWindowDays,
      newcomerCutoffIso: null,
      newcomerSources: 0,
      newcomerTokens: 0,
      newcomerTokenShare: 0,
    };
  } else {
    const cutoffMs = asOfMs - newcomerWindowDays * DAY_MS;
    const cutoffIso = new Date(cutoffMs).toISOString();
    let newcomerSources = 0;
    let newcomerTokens = 0;
    for (const row of allRows) {
      const firstMs = Date.parse(row.firstSeen);
      if (firstMs >= cutoffMs) {
        newcomerSources += 1;
        newcomerTokens += row.tokens;
      }
    }
    const newcomerTokenShare =
      totalTokens > 0 ? newcomerTokens / totalTokens : 0;
    newcomerRollup = {
      newcomerWindowDays,
      newcomerCutoffIso: cutoffIso,
      newcomerSources,
      newcomerTokens,
      newcomerTokenShare,
    };
  }

  // Apply minBuckets floor, then debutShareMin floor.
  const survived: SourceDebutRecencyRow[] = [];
  let droppedBelowDebutShareMin = 0;
  for (const row of allRows) {
    if (row.activeBuckets < minBuckets) {
      droppedSparseSources += 1;
      continue;
    }
    if (row.debutShare < debutShareMin) {
      droppedBelowDebutShareMin += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'recency') {
      primary = a.daysSinceDebut - b.daysSinceDebut;
      if (primary === 0) primary = b.tokens - a.tokens;
    } else if (sort === 'tokens') {
      primary = b.tokens - a.tokens;
    } else if (sort === 'tenure') {
      primary = b.tenureHours - a.tenureHours;
    } else if (sort === 'debutshare') {
      primary = b.debutShare - a.debutShare;
      if (primary === 0) primary = b.tokens - a.tokens;
    } else {
      // 'idle'
      primary = b.daysSinceLastSeen - a.daysSinceLastSeen;
      if (primary === 0) primary = b.tokens - a.tokens;
    }
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
    model: modelFilter,
    asOf: asOfIso,
    debutWindowFraction,
    minBuckets,
    top,
    sort,
    totalSources: allRows.length,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedModelFilter,
    droppedSparseSources,
    droppedBelowDebutShareMin,
    debutShareMin,
    droppedBelowTopCap,
    newcomerRollup,
    sources: finalSources,
  };
}
