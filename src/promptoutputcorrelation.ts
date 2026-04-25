/**
 * prompt-output-correlation: per-group Pearson correlation
 * coefficient between hour-bucket prompt-token mass and
 * output-token mass.
 *
 * For each (group, hour_start) cell, sums `input_tokens` and
 * `output_tokens`. Per group, computes the Pearson r over the
 * resulting (x = hourly prompt tokens, y = hourly output tokens)
 * series (one point per active hour bucket). Also reports the
 * OLS slope (output per prompt token) and the intercept — useful
 * for separating "this model is structurally chatty" (high
 * intercept) from "this model scales output linearly with prompt
 * size" (slope ~ output/input ratio, low intercept).
 *
 * Why a fresh subcommand:
 *
 *   - `output-input-ratio` is a single scalar per model
 *     (totalOutput / totalInput). It cannot tell you whether
 *     bigger prompts produce proportionally bigger replies, or
 *     whether the model has a flat output budget regardless of
 *     prompt size. Two models with identical ratio = 0.5 can have
 *     r = +0.95 (output tracks prompt) or r = -0.30 (output
 *     shrinks as prompt grows — usually a context-truncation /
 *     refusal pattern).
 *   - `burstiness` looks at variance of *one* series (total
 *     tokens). It cannot relate two series.
 *   - `prompt-size` and `output-size` are independent
 *     distributions; nothing links them per bucket.
 *   - `cohabitation`, `interarrival`, `bucket-handoff-frequency`,
 *     `bucket-streak-length`: all axis-of-time analyses, not
 *     between-series correlations.
 *
 * The Pearson r is bounded in [-1, +1]. Report shape:
 *
 *   - `pearsonR`: standard Pearson coefficient over active buckets
 *   - `slope`, `intercept`: ordinary-least-squares fit
 *     y = slope*x + intercept (in tokens per token + tokens). For
 *     a model with r ≈ 0 the slope/intercept are near-meaningless;
 *     callers should check r first.
 *   - `meanInput`, `meanOutput`, `stdInput`, `stdOutput`: per
 *     active-bucket population stats. Lets the caller spot
 *     pathological inputs (zero variance in x = constant prompt
 *     size, would force r to undefined; we return 0 in that case
 *     and surface it via `degenerate=true`).
 *   - `activeBuckets`: number of (x,y) pairs the fit was over.
 *   - `degenerate`: true when stdInput == 0 or stdOutput == 0
 *     (Pearson formula divides by zero in either case). Caller
 *     must treat r as not-meaningful in that case.
 *
 * Determinism: pure builder. `Date.now()` only via
 * `opts.generatedAt`. Reductions iterate sorted keys for stable
 * stringify-equality across runs. Empty input and zero-token
 * windows return a well-formed all-zero report.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export type PromptOutputCorrelationDimension = 'model' | 'source';
export type PromptOutputCorrelationSort =
  | 'tokens'
  | 'r'
  | 'abs-r'
  | 'buckets'
  | 'slope';

export interface PromptOutputCorrelationOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Group rows by `model` (default) or by `source`. */
  by?: PromptOutputCorrelationDimension;
  /**
   * Drop group rows whose `activeBuckets` count is `< minBuckets`.
   * Display filter only — global denominators reflect the full
   * population. Default 2 (Pearson r needs ≥ 2 points to be
   * defined at all).
   */
  minBuckets?: number;
  /**
   * Drop group rows whose `totalTokens` is `< minTokens`. Display
   * filter only — global denominators reflect the full population.
   * Default 0 (keep every group).
   *
   * Useful for sweeping out the long tail of low-mass groups
   * before sorting by `r` / `abs-r`, where a group with 3 buckets
   * and ~100 tokens trivially produces a high-magnitude r that
   * crowds out the headline.
   */
  minTokens?: number;
  /**
   * Truncate `groups[]` to the top N by total tokens (post-sort).
   * Display filter only. Default 0 (no truncation).
   */
  top?: number;
  /**
   * Sort key for `groups[]`. Default `tokens` (desc). All keys
   * are descending on the primary field with a lex tiebreak on
   * the group name. `abs-r` sorts by |r| desc — useful when you
   * want strongest correlations regardless of sign.
   */
  sort?: PromptOutputCorrelationSort;
  /**
   * Pre-aggregation row filter on `source`. When set, only rows
   * whose `source` exactly matches are included. null/undefined =
   * no filter. Affects both group rows AND global denominators
   * (the filter narrows the population we're describing — same
   * convention as `device-tenure`'s `--source`).
   */
  source?: string | null;
  /**
   * Pre-aggregation row filter on `model` (compared after
   * `normaliseModel`). null/undefined = no filter. Same
   * population-narrowing semantics as `source` above.
   */
  model?: string | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface PromptOutputCorrelationGroupRow {
  /**
   * Group key. When `by === 'model'` this is the normalised model
   * id; when `by === 'source'` this is the raw source string.
   * Field name kept as `model` for downstream JSON consumer
   * symmetry with the rest of the size/share family.
   */
  model: string;
  /** Sum of total_tokens (input + output + everything) over kept rows. */
  totalTokens: number;
  /** Sum of input_tokens over kept rows. */
  totalInputTokens: number;
  /** Sum of output_tokens over kept rows. */
  totalOutputTokens: number;
  /** Distinct hour_start buckets contributing to this group. */
  activeBuckets: number;
  /** Mean per-bucket input_tokens. */
  meanInput: number;
  /** Mean per-bucket output_tokens. */
  meanOutput: number;
  /** Population stddev of per-bucket input_tokens. */
  stdInput: number;
  /** Population stddev of per-bucket output_tokens. */
  stdOutput: number;
  /** Pearson r over the (input, output) pairs. 0 if degenerate. */
  pearsonR: number;
  /** OLS slope: output per prompt token. 0 if stdInput == 0. */
  slope: number;
  /** OLS intercept (tokens). 0 if stdInput == 0. */
  intercept: number;
  /**
   * True when stdInput == 0 or stdOutput == 0 — Pearson r is
   * mathematically undefined in either case; we return 0 and
   * flip this flag so callers can hide / footnote the row.
   */
  degenerate: boolean;
}

export interface PromptOutputCorrelationReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  by: PromptOutputCorrelationDimension;
  minBuckets: number;
  minTokens: number;
  top: number;
  sort: PromptOutputCorrelationSort;
  /** Echo of the resolved `source` row filter (null = no filter). */
  sourceFilter: string | null;
  /** Echo of the resolved `model` row filter (null = no filter). */
  modelFilter: string | null;
  /** Sum of total_tokens across all kept rows in the window. */
  totalTokens: number;
  /** Sum of input_tokens across all kept rows in the window. */
  totalInputTokens: number;
  /** Sum of output_tokens across all kept rows in the window. */
  totalOutputTokens: number;
  /** Distinct hour_start buckets across all groups (union). */
  totalActiveBuckets: number;
  /** Distinct group keys observed in the window (pre-filter). */
  totalGroups: number;
  /** Pearson r across all (input, output) bucket pairs (any group). */
  globalPearsonR: number;
  /** OLS slope across the global pool. 0 if degenerate. */
  globalSlope: number;
  /** OLS intercept across the global pool. */
  globalIntercept: number;
  /** True if global stdInput == 0 or stdOutput == 0. */
  globalDegenerate: boolean;
  /** Rows where hour_start did not parse as an ISO instant. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 or non-finite. */
  droppedZeroTokens: number;
  /** Rows dropped by the --source filter. */
  droppedBySourceFilter: number;
  /** Rows dropped by the --model filter. */
  droppedByModelFilter: number;
  /** Group rows hidden by the minBuckets floor. */
  droppedSparseGroups: number;
  /** Group rows hidden by the minTokens floor. */
  droppedLowTokenGroups: number;
  /** Group rows hidden by the `top` cap (counted after the floors). */
  droppedTopGroups: number;
  /**
   * One row per kept group. Sorted per `sort` (desc) with lex
   * tiebreak on `model` asc.
   */
  groups: PromptOutputCorrelationGroupRow[];
}

interface BucketAgg {
  input: number;
  output: number;
}

function pearsonAndOls(xs: number[], ys: number[]): {
  r: number;
  slope: number;
  intercept: number;
  meanX: number;
  meanY: number;
  stdX: number;
  stdY: number;
  degenerate: boolean;
} {
  const n = xs.length;
  if (n < 2) {
    const meanX = n === 1 ? (xs[0] ?? 0) : 0;
    const meanY = n === 1 ? (ys[0] ?? 0) : 0;
    return {
      r: 0,
      slope: 0,
      intercept: 0,
      meanX,
      meanY,
      stdX: 0,
      stdY: 0,
      degenerate: true,
    };
  }
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i] ?? 0;
    sumY += ys[i] ?? 0;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] ?? 0) - meanX;
    const dy = (ys[i] ?? 0) - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const stdX = Math.sqrt(sxx / n);
  const stdY = Math.sqrt(syy / n);
  if (sxx === 0 || syy === 0) {
    return {
      r: 0,
      slope: 0,
      intercept: 0,
      meanX,
      meanY,
      stdX,
      stdY,
      degenerate: true,
    };
  }
  const r = sxy / Math.sqrt(sxx * syy);
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  return { r, slope, intercept, meanX, meanY, stdX, stdY, degenerate: false };
}

export function buildPromptOutputCorrelation(
  queue: QueueLine[],
  opts: PromptOutputCorrelationOptions = {},
): PromptOutputCorrelationReport {
  const minBuckets = opts.minBuckets ?? 2;
  if (!Number.isInteger(minBuckets) || minBuckets < 1) {
    throw new Error(
      `minBuckets must be a positive integer (got ${opts.minBuckets})`,
    );
  }
  const minTokens = opts.minTokens ?? 0;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative number (got ${opts.minTokens})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const by: PromptOutputCorrelationDimension = opts.by ?? 'model';
  if (by !== 'model' && by !== 'source') {
    throw new Error(`by must be 'model' or 'source' (got ${opts.by})`);
  }
  const sort: PromptOutputCorrelationSort = opts.sort ?? 'tokens';
  if (
    sort !== 'tokens' &&
    sort !== 'r' &&
    sort !== 'abs-r' &&
    sort !== 'buckets' &&
    sort !== 'slope'
  ) {
    throw new Error(
      `sort must be one of tokens|r|abs-r|buckets|slope (got ${opts.sort})`,
    );
  }
  const sourceFilter =
    opts.source != null && opts.source !== '' ? opts.source : null;
  const modelFilterRaw =
    opts.model != null && opts.model !== '' ? opts.model : null;
  const modelFilter =
    modelFilterRaw != null ? normaliseModel(modelFilterRaw) : null;

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  // group -> hour_start -> { input, output }
  const agg = new Map<string, Map<string, BucketAgg>>();
  // also track per-row totalTokens by group for headline
  const totalTokensByGroup = new Map<string, number>();
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedBySourceFilter = 0;
  let droppedByModelFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    if (sourceFilter !== null && q.source !== sourceFilter) {
      droppedBySourceFilter += 1;
      continue;
    }
    if (modelFilter !== null) {
      const normM = normaliseModel(typeof q.model === 'string' ? q.model : '');
      if (normM !== modelFilter) {
        droppedByModelFilter += 1;
        continue;
      }
    }

    const tt = Number(q.total_tokens);
    if (!Number.isFinite(tt) || tt <= 0) {
      droppedZeroTokens += 1;
      continue;
    }
    const inTok = Number(q.input_tokens);
    const outTok = Number(q.output_tokens);
    if (!Number.isFinite(inTok) || !Number.isFinite(outTok)) {
      droppedZeroTokens += 1;
      continue;
    }

    const groupKey =
      by === 'source'
        ? typeof q.source === 'string' && q.source !== ''
          ? q.source
          : 'unknown'
        : normaliseModel(typeof q.model === 'string' ? q.model : '');

    let buckets = agg.get(groupKey);
    if (!buckets) {
      buckets = new Map<string, BucketAgg>();
      agg.set(groupKey, buckets);
    }
    let cell = buckets.get(q.hour_start);
    if (!cell) {
      cell = { input: 0, output: 0 };
      buckets.set(q.hour_start, cell);
    }
    cell.input += inTok;
    cell.output += outTok;
    totalTokensByGroup.set(
      groupKey,
      (totalTokensByGroup.get(groupKey) ?? 0) + tt,
    );
  }

  const totalGroups = agg.size;
  const groupsAll: PromptOutputCorrelationGroupRow[] = [];
  let droppedSparseGroups = 0;
  let droppedLowTokenGroups = 0;

  // global pool of (x, y) across every (group, bucket)
  const globalXs: number[] = [];
  const globalYs: number[] = [];
  let totalTokens = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const globalBucketSet = new Set<string>();

  // iterate sorted groups for determinism
  const groupKeys = Array.from(agg.keys()).sort();
  for (const groupKey of groupKeys) {
    const buckets = agg.get(groupKey)!;
    // iterate buckets sorted by hour_start for determinism
    const hourKeys = Array.from(buckets.keys()).sort();
    const xs: number[] = [];
    const ys: number[] = [];
    let inSum = 0;
    let outSum = 0;
    for (const h of hourKeys) {
      const cell = buckets.get(h)!;
      xs.push(cell.input);
      ys.push(cell.output);
      inSum += cell.input;
      outSum += cell.output;
      globalXs.push(cell.input);
      globalYs.push(cell.output);
      globalBucketSet.add(h);
    }
    const stats = pearsonAndOls(xs, ys);
    const tok = totalTokensByGroup.get(groupKey) ?? 0;
    totalTokens += tok;
    totalInputTokens += inSum;
    totalOutputTokens += outSum;

    if (xs.length < minBuckets) {
      droppedSparseGroups += 1;
      continue;
    }
    if (tok < minTokens) {
      droppedLowTokenGroups += 1;
      continue;
    }
    groupsAll.push({
      model: groupKey,
      totalTokens: tok,
      totalInputTokens: inSum,
      totalOutputTokens: outSum,
      activeBuckets: xs.length,
      meanInput: stats.meanX,
      meanOutput: stats.meanY,
      stdInput: stats.stdX,
      stdOutput: stats.stdY,
      pearsonR: stats.r,
      slope: stats.slope,
      intercept: stats.intercept,
      degenerate: stats.degenerate,
    });
  }

  const sortFn = (
    a: PromptOutputCorrelationGroupRow,
    b: PromptOutputCorrelationGroupRow,
  ): number => {
    let primary = 0;
    switch (sort) {
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'r':
        primary = b.pearsonR - a.pearsonR;
        break;
      case 'abs-r':
        primary = Math.abs(b.pearsonR) - Math.abs(a.pearsonR);
        break;
      case 'buckets':
        primary = b.activeBuckets - a.activeBuckets;
        break;
      case 'slope':
        primary = b.slope - a.slope;
        break;
    }
    if (primary !== 0) return primary;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  };
  groupsAll.sort(sortFn);

  let droppedTopGroups = 0;
  let kept = groupsAll;
  if (top > 0 && groupsAll.length > top) {
    droppedTopGroups = groupsAll.length - top;
    kept = groupsAll.slice(0, top);
  }

  const globalStats = pearsonAndOls(globalXs, globalYs);

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    by,
    minBuckets,
    minTokens,
    top,
    sort,
    sourceFilter,
    modelFilter,
    totalTokens,
    totalInputTokens,
    totalOutputTokens,
    totalActiveBuckets: globalBucketSet.size,
    totalGroups,
    globalPearsonR: globalStats.r,
    globalSlope: globalStats.slope,
    globalIntercept: globalStats.intercept,
    globalDegenerate: globalStats.degenerate,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedBySourceFilter,
    droppedByModelFilter,
    droppedSparseGroups,
    droppedLowTokenGroups,
    droppedTopGroups,
    groups: kept,
  };
}
