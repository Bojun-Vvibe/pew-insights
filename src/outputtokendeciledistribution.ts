/**
 * output-token-decile-distribution: rank every active bucket row in
 * `queue.jsonl` by `output_tokens` ascending and partition into ten
 * equal-sized deciles (D1 = lightest 10% of buckets, D10 = heaviest
 * 10%). For each decile we report:
 *
 *   - decile:        1..10
 *   - bucketCount:   number of bucket rows in this decile
 *   - tokensInDecile: sum of output_tokens contributed by this decile
 *   - shareOfTokens: tokensInDecile / totalOutputTokens
 *   - meanOutput:    tokensInDecile / bucketCount
 *   - minOutput:     min output_tokens in this decile
 *   - maxOutput:     max output_tokens in this decile
 *
 * Plus window-wide concentration scalars:
 *
 *   - gini:          Gini coefficient over per-bucket output_tokens
 *                    (0 = perfectly uniform, →1 = all mass in one
 *                    bucket). Computed exactly from the sorted
 *                    sequence (no sampling).
 *   - p90Share:      share of total output_tokens contributed by
 *                    the top 10% of buckets — i.e. shareOfTokens(D10)
 *   - p99Share:      share contributed by the top 1% of buckets,
 *                    interpolated from the sorted sequence.
 *
 * Why this is orthogonal to what already ships:
 *
 *   - `output-size` reports per-model summary stats (mean / median /
 *     max) of `output_tokens`. It does not partition the population
 *     into deciles or surface a Lorenz curve, and it groups by
 *     model rather than by global rank.
 *   - `tail-share` reports per-source top-K% concentration with
 *     fixed K ∈ {1, 5, 10, 20}, against `total_tokens`. It is
 *     per-source, top-only, and total-token-based.
 *   - `bucket-intensity` is `total_tokens` distribution per bucket,
 *     not output-only.
 *   - `output-input-ratio` is a *ratio* lens, not an absolute
 *     output-mass distribution.
 *   - `cost`, `provider-share`, `time-of-day` ignore decile geometry.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';

export interface OutputTokenDecileDistributionOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop bucket rows whose `output_tokens` < this floor *before*
   * partitioning into deciles. Suppressed rows surface as
   * `droppedBelowMinOutput`. Default 0 = no floor (zero-output rows
   * are still excluded separately as `droppedZeroOutput`).
   */
  minOutput?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface OutputDecileRow {
  /** 1..10 (1 = lightest decile, 10 = heaviest decile). */
  decile: number;
  /** Number of bucket rows in this decile. */
  bucketCount: number;
  /** Sum of output_tokens from rows in this decile. */
  tokensInDecile: number;
  /** tokensInDecile / totalOutputTokens (0 if total is 0). */
  shareOfTokens: number;
  /** tokensInDecile / bucketCount (0 if empty). */
  meanOutput: number;
  /** min output_tokens in this decile (0 if empty). */
  minOutput: number;
  /** max output_tokens in this decile (0 if empty). */
  maxOutput: number;
}

export interface OutputTokenDecileDistributionReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  /** Echo of the resolved `minOutput` floor (0 = no floor). */
  minOutput: number;
  /** Number of bucket rows kept for the analysis. */
  bucketCount: number;
  /** Sum of output_tokens across all kept rows. */
  totalOutputTokens: number;
  /** Gini coefficient over per-bucket output_tokens; null if no rows. */
  gini: number | null;
  /** Share of total output_tokens from the top 10% of buckets; null if no rows. */
  p90Share: number | null;
  /** Share of total output_tokens from the top 1% of buckets; null if no rows. */
  p99Share: number | null;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with output_tokens < 0 / non-finite. */
  droppedInvalidOutput: number;
  /** Rows with output_tokens == 0 (kept out of the ranked population). */
  droppedZeroOutput: number;
  /** Rows with output_tokens > 0 but below the `minOutput` floor. */
  droppedBelowMinOutput: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Per-decile rows, always D1..D10. Empty deciles report zeros. */
  deciles: OutputDecileRow[];
}

export function buildOutputTokenDecileDistribution(
  queue: QueueLine[],
  opts: OutputTokenDecileDistributionOptions = {},
): OutputTokenDecileDistributionReport {
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
  const minOutput = opts.minOutput ?? 0;
  if (!Number.isFinite(minOutput) || minOutput < 0) {
    throw new Error(`minOutput must be a non-negative finite number (got ${opts.minOutput})`);
  }
  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  let droppedInvalidHourStart = 0;
  let droppedInvalidOutput = 0;
  let droppedZeroOutput = 0;
  let droppedBelowMinOutput = 0;
  let droppedSourceFilter = 0;

  const outputs: number[] = [];

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const out = Number(q.output_tokens);
    if (!Number.isFinite(out) || out < 0) {
      droppedInvalidOutput += 1;
      continue;
    }

    const src = typeof q.source === 'string' ? q.source : '';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    if (out === 0) {
      droppedZeroOutput += 1;
      continue;
    }

    if (minOutput > 0 && out < minOutput) {
      droppedBelowMinOutput += 1;
      continue;
    }

    outputs.push(out);
  }

  outputs.sort((a, b) => a - b);

  const bucketCount = outputs.length;
  const totalOutputTokens = outputs.reduce((s, x) => s + x, 0);

  // Build empty-default deciles first.
  const deciles: OutputDecileRow[] = [];
  for (let d = 1; d <= 10; d++) {
    deciles.push({
      decile: d,
      bucketCount: 0,
      tokensInDecile: 0,
      shareOfTokens: 0,
      meanOutput: 0,
      minOutput: 0,
      maxOutput: 0,
    });
  }

  let gini: number | null = null;
  let p90Share: number | null = null;
  let p99Share: number | null = null;

  if (bucketCount > 0) {
    // Partition by index. We want D1..D10 each with floor(N/10) or
    // ceil(N/10) entries — distribute the remainder onto the lowest
    // deciles. This is the classical "equal-bin-by-rank" definition,
    // matching numpy.array_split / pandas.qcut behaviour.
    const base = Math.floor(bucketCount / 10);
    const remainder = bucketCount - base * 10; // 0..9 extra entries
    let cursor = 0;
    for (let d = 0; d < 10; d++) {
      const size = base + (d < remainder ? 1 : 0);
      if (size === 0) continue;
      const slice = outputs.slice(cursor, cursor + size);
      const sum = slice.reduce((s, x) => s + x, 0);
      deciles[d] = {
        decile: d + 1,
        bucketCount: size,
        tokensInDecile: sum,
        shareOfTokens: totalOutputTokens > 0 ? sum / totalOutputTokens : 0,
        meanOutput: sum / size,
        minOutput: slice[0]!,
        maxOutput: slice[slice.length - 1]!,
      };
      cursor += size;
    }

    // Gini: classical formula on sorted ascending values.
    //   G = (2 * Σ i*x_i) / (n * Σ x_i)  -  (n + 1) / n
    // Use 1-indexed i.
    if (totalOutputTokens > 0) {
      let weighted = 0;
      for (let i = 0; i < bucketCount; i++) {
        weighted += (i + 1) * outputs[i]!;
      }
      gini = (2 * weighted) / (bucketCount * totalOutputTokens) - (bucketCount + 1) / bucketCount;
      // Clamp tiny floating drift.
      if (gini < 0) gini = 0;
    } else {
      gini = 0;
    }

    // Top-K% share: take the heaviest k buckets.
    p90Share = topKShare(outputs, totalOutputTokens, 0.10);
    p99Share = topKShare(outputs, totalOutputTokens, 0.01);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    minOutput,
    bucketCount,
    totalOutputTokens,
    gini,
    p90Share,
    p99Share,
    droppedInvalidHourStart,
    droppedInvalidOutput,
    droppedZeroOutput,
    droppedBelowMinOutput,
    droppedSourceFilter,
    deciles,
  };
}

/**
 * Share of `total` contributed by the top `frac` (e.g. 0.10) of the
 * sorted-ascending sequence. Uses ceil to ensure we never report a
 * larger window than the user asked for; for tiny populations we
 * always include at least 1 bucket.
 */
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
