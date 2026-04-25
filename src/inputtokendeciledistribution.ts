/**
 * input-token-decile-distribution: rank every active bucket row in
 * `queue.jsonl` by `input_tokens` ascending and partition into ten
 * equal-sized deciles (D1 = lightest 10% of buckets, D10 = heaviest
 * 10%). For each decile we report:
 *
 *   - decile:        1..10
 *   - bucketCount:   number of bucket rows in this decile
 *   - tokensInDecile: sum of input_tokens contributed by this decile
 *   - shareOfTokens: tokensInDecile / totalInputTokens
 *   - meanInput:     tokensInDecile / bucketCount
 *   - minInput:      min input_tokens in this decile
 *   - maxInput:      max input_tokens in this decile
 *
 * Plus window-wide concentration scalars:
 *
 *   - gini:          Gini coefficient over per-bucket input_tokens
 *                    (0 = perfectly uniform, →1 = all mass in one
 *                    bucket).
 *   - p90Share:      share of total input_tokens contributed by
 *                    the top 10% of buckets — i.e. shareOfTokens(D10)
 *   - p99Share:      share contributed by the top 1% of buckets,
 *                    interpolated from the sorted sequence.
 *
 * Why this is orthogonal to what already ships:
 *
 *   - `output-token-decile-distribution` partitions on
 *     `output_tokens`. This lens partitions on `input_tokens`
 *     (the *context* / *prompt* side of cost, not the generation
 *     side). The two are weakly correlated at best — long-context
 *     read-only tasks (file scans, search queries) emit large
 *     input but small output; long generations (essays, code
 *     synthesis) do the opposite.
 *   - `prompt-size` reports per-source summary stats (mean / median
 *     / max / p95) of `input_tokens`. It does not partition the
 *     population into deciles or surface a Lorenz curve, and it
 *     groups by source rather than by global rank.
 *   - `output-input-ratio`, `prompt-output-correlation` are *ratio*
 *     / *correlation* lenses, not absolute input-mass distributions.
 *   - `cache-hit-ratio` looks at `cached_input_tokens / input_tokens`
 *     within each row; it never ranks the population.
 *   - `bucket-intensity` is `total_tokens` distribution per bucket,
 *     not input-only.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';

export interface InputTokenDecileDistributionOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop bucket rows whose `input_tokens` < this floor *before*
   * partitioning into deciles. Suppressed rows surface as
   * `droppedBelowMinInput`. Default 0 = no floor (zero-input rows
   * are still excluded separately as `droppedZeroInput`).
   */
  minInput?: number;
  /**
   * Surface the heaviest N individual buckets (after all filters
   * and the minInput floor) as `topBuckets`. Useful for drilling
   * into D10 outliers. Default 0 = no top list. Capped at the
   * actual surviving population.
   */
  top?: number;
  /**
   * Surface the lightest N individual buckets (after all filters
   * and the minInput floor) as `bottomBuckets`, sorted ascending.
   * Useful for understanding the long-tail floor — what does a
   * "minimum-viable hour" actually look like? Default 0 = no
   * bottom list. Capped at the actual surviving population.
   */
  bottom?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface InputDecileRow {
  /** 1..10 (1 = lightest decile, 10 = heaviest decile). */
  decile: number;
  /** Number of bucket rows in this decile. */
  bucketCount: number;
  /** Sum of input_tokens from rows in this decile. */
  tokensInDecile: number;
  /** tokensInDecile / totalInputTokens (0 if total is 0). */
  shareOfTokens: number;
  /** tokensInDecile / bucketCount (0 if empty). */
  meanInput: number;
  /** min input_tokens in this decile (0 if empty). */
  minInput: number;
  /** max input_tokens in this decile (0 if empty). */
  maxInput: number;
}

export interface InputTokenDecileDistributionReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  /** Echo of the resolved `minInput` floor (0 = no floor). */
  minInput: number;
  /** Echo of the resolved `top` cap (0 = no top list). */
  top: number;
  /** Echo of the resolved `bottom` cap (0 = no bottom list). */
  bottom: number;
  /** Number of bucket rows kept for the analysis. */
  bucketCount: number;
  /** Sum of input_tokens across all kept rows. */
  totalInputTokens: number;
  /** Gini coefficient over per-bucket input_tokens; null if no rows. */
  gini: number | null;
  /** Share of total input_tokens from the top 10% of buckets; null if no rows. */
  p90Share: number | null;
  /** Share of total input_tokens from the top 1% of buckets; null if no rows. */
  p99Share: number | null;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with input_tokens < 0 / non-finite. */
  droppedInvalidInput: number;
  /** Rows with input_tokens == 0 (kept out of the ranked population). */
  droppedZeroInput: number;
  /** Rows with input_tokens > 0 but below the `minInput` floor. */
  droppedBelowMinInput: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Per-decile rows, always D1..D10. Empty deciles report zeros. */
  deciles: InputDecileRow[];
  /**
   * Heaviest individual buckets, sorted descending by input_tokens.
   * Length == min(top, bucketCount). Empty when top=0 or no rows.
   */
  topBuckets: InputBucketRow[];
  /**
   * Lightest individual buckets, sorted ascending by input_tokens.
   * Length == min(bottom, bucketCount). Empty when bottom=0 or
   * no rows.
   */
  bottomBuckets: InputBucketRow[];
}

export interface InputBucketRow {
  hourStart: string;
  source: string;
  model: string;
  inputTokens: number;
  /** Which decile this bucket landed in (1..10). */
  decile: number;
  /** inputTokens / totalInputTokens (0 if total is 0). */
  shareOfTotal: number;
}

export function buildInputTokenDecileDistribution(
  queue: QueueLine[],
  opts: InputTokenDecileDistributionOptions = {},
): InputTokenDecileDistributionReport {
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
  const minInput = opts.minInput ?? 0;
  if (!Number.isFinite(minInput) || minInput < 0) {
    throw new Error(`minInput must be a non-negative finite number (got ${opts.minInput})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isFinite(top) || top < 0 || !Number.isInteger(top)) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const bottom = opts.bottom ?? 0;
  if (!Number.isFinite(bottom) || bottom < 0 || !Number.isInteger(bottom)) {
    throw new Error(`bottom must be a non-negative integer (got ${opts.bottom})`);
  }
  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  let droppedInvalidHourStart = 0;
  let droppedInvalidInput = 0;
  let droppedZeroInput = 0;
  let droppedBelowMinInput = 0;
  let droppedSourceFilter = 0;

  // Collect both the value (for ranking/decile math) and the row
  // metadata (for the topBuckets list). Same iteration, no extra
  // pass over the queue.
  interface Kept {
    inp: number;
    hourStart: string;
    source: string;
    model: string;
  }
  const kept: Kept[] = [];

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const inp = Number(q.input_tokens);
    if (!Number.isFinite(inp) || inp < 0) {
      droppedInvalidInput += 1;
      continue;
    }

    const src = typeof q.source === 'string' ? q.source : '';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    if (inp === 0) {
      droppedZeroInput += 1;
      continue;
    }

    if (minInput > 0 && inp < minInput) {
      droppedBelowMinInput += 1;
      continue;
    }

    kept.push({
      inp,
      hourStart: q.hour_start,
      source: src,
      model: typeof q.model === 'string' ? q.model : '',
    });
  }

  // Stable sort ascending by inp; tie-break by hourStart so the
  // ordering is deterministic regardless of input row order.
  kept.sort((a, b) => {
    if (a.inp !== b.inp) return a.inp - b.inp;
    return a.hourStart < b.hourStart ? -1 : a.hourStart > b.hourStart ? 1 : 0;
  });

  const inputs = kept.map((k) => k.inp);

  const bucketCount = inputs.length;
  const totalInputTokens = inputs.reduce((s, x) => s + x, 0);

  const deciles: InputDecileRow[] = [];
  for (let d = 1; d <= 10; d++) {
    deciles.push({
      decile: d,
      bucketCount: 0,
      tokensInDecile: 0,
      shareOfTokens: 0,
      meanInput: 0,
      minInput: 0,
      maxInput: 0,
    });
  }

  let gini: number | null = null;
  let p90Share: number | null = null;
  let p99Share: number | null = null;

  // Per-index decile assignment (0-based -> decile 1..10), computed
  // once and reused both for deciles[] aggregation and for tagging
  // entries that bubble into topBuckets.
  const decileOf: number[] = new Array(bucketCount).fill(0);

  if (bucketCount > 0) {
    const base = Math.floor(bucketCount / 10);
    const remainder = bucketCount - base * 10;
    let cursor = 0;
    for (let d = 0; d < 10; d++) {
      const size = base + (d < remainder ? 1 : 0);
      if (size === 0) continue;
      const slice = inputs.slice(cursor, cursor + size);
      const sum = slice.reduce((s, x) => s + x, 0);
      for (let i = cursor; i < cursor + size; i++) decileOf[i] = d + 1;
      deciles[d] = {
        decile: d + 1,
        bucketCount: size,
        tokensInDecile: sum,
        shareOfTokens: totalInputTokens > 0 ? sum / totalInputTokens : 0,
        meanInput: sum / size,
        minInput: slice[0]!,
        maxInput: slice[slice.length - 1]!,
      };
      cursor += size;
    }

    if (totalInputTokens > 0) {
      let weighted = 0;
      for (let i = 0; i < bucketCount; i++) {
        weighted += (i + 1) * inputs[i]!;
      }
      gini = (2 * weighted) / (bucketCount * totalInputTokens) - (bucketCount + 1) / bucketCount;
      if (gini < 0) gini = 0;
    } else {
      gini = 0;
    }

    p90Share = topKShare(inputs, totalInputTokens, 0.10);
    p99Share = topKShare(inputs, totalInputTokens, 0.01);
  }

  const topBuckets: InputBucketRow[] = [];
  if (top > 0 && bucketCount > 0) {
    const k = Math.min(top, bucketCount);
    // Pull from the high end of the sorted array; reverse so the
    // result is descending by inputTokens (heaviest first).
    for (let i = bucketCount - 1; i >= bucketCount - k; i--) {
      const e = kept[i]!;
      topBuckets.push({
        hourStart: e.hourStart,
        source: e.source,
        model: e.model,
        inputTokens: e.inp,
        decile: decileOf[i]!,
        shareOfTotal: totalInputTokens > 0 ? e.inp / totalInputTokens : 0,
      });
    }
  }

  const bottomBuckets: InputBucketRow[] = [];
  if (bottom > 0 && bucketCount > 0) {
    const k = Math.min(bottom, bucketCount);
    // Pull from the low end of the sorted array; ascending order.
    for (let i = 0; i < k; i++) {
      const e = kept[i]!;
      bottomBuckets.push({
        hourStart: e.hourStart,
        source: e.source,
        model: e.model,
        inputTokens: e.inp,
        decile: decileOf[i]!,
        shareOfTotal: totalInputTokens > 0 ? e.inp / totalInputTokens : 0,
      });
    }
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    minInput,
    top,
    bottom,
    bucketCount,
    totalInputTokens,
    gini,
    p90Share,
    p99Share,
    droppedInvalidHourStart,
    droppedInvalidInput,
    droppedZeroInput,
    droppedBelowMinInput,
    droppedSourceFilter,
    deciles,
    topBuckets,
    bottomBuckets,
  };
}

function topKShare(
  sortedAsc: number[],
  total: number,
  frac: number,
): number {
  if (sortedAsc.length === 0 || total <= 0) return 0;
  const k = Math.max(1, Math.ceil(sortedAsc.length * frac));
  let sum = 0;
  for (let i = sortedAsc.length - k; i < sortedAsc.length; i++) {
    sum += sortedAsc[i]!;
  }
  return sum / total;
}
