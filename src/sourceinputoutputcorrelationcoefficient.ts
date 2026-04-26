/**
 * source-input-output-correlation-coefficient: per-source Pearson
 * correlation coefficient (r) between per-row `input_tokens` and
 * per-row `output_tokens`.
 *
 * Headline question: **for each source, does a bigger prompt
 * predict a bigger response?** A high positive r says "longer in,
 * longer out" (the source's prompts and responses scale together —
 * typical of Q&A or doc-completion style use); r near 0 says
 * "prompt size and response size are decoupled" (typical of
 * agentic loops where a giant context produces a tiny tool call,
 * or a tiny prompt produces a long generation); a negative r is
 * unusual and worth a closer look.
 *
 * Pearson r on (in_i, out_i):
 *
 *     r = sum((in_i - mean_in) * (out_i - mean_out))
 *         / sqrt( sum((in_i - mean_in)^2) * sum((out_i - mean_out)^2) )
 *
 * computed with the two-pass numerically-stable formulation. r is
 * in [-1, +1], invariant to linear rescaling of either axis,
 * undefined if either column has zero variance.
 *
 * Distinct from every existing lens:
 *
 *   - `prompt-output-correlation` (existing) reports a single
 *     workspace-wide Pearson r aggregated across all sources; it
 *     does not rank or compare sources. Two workspaces with the
 *     same global r can have wildly different per-source r values
 *     (Simpson's-paradox-style mixing). This subcommand reports r
 *     per source so you can see which producers are the
 *     "scales-with-prompt" cohort and which are the "decoupled"
 *     cohort.
 *   - `source-output-input-ratio` / `outputinputratio` reports the
 *     *ratio* out/in, which is a level statistic and is dominated
 *     by the mean — a source can have a high mean ratio with
 *     near-zero correlation (consistently large outputs regardless
 *     of input) or a low mean ratio with a strong correlation
 *     (small outputs that nonetheless scale tightly with input).
 *   - `source-io-ratio-stability` reports CV of the per-row
 *     out/in ratio — that is a dispersion statistic on the ratio,
 *     not a linear-association statistic on the raw pair.
 *   - `source-input-token-top-row-share` reports input-mass
 *     concentration (Pareto-style); says nothing about whether
 *     output co-moves with input.
 *
 * Per surviving source we compute:
 *
 *   - rows:           total kept rows for the source (after window
 *                     + source filter + invalid hour_start drop).
 *   - positivePairs:  count of rows where input_tokens > 0 AND
 *                     output_tokens > 0. Pearson r is computed on
 *                     these pairs only — pairs with a zero on
 *                     either axis collapse the variance estimate
 *                     in misleading ways (a source whose every
 *                     "small" prompt produces 0 output would show
 *                     a spurious "r = 1" because every (0, 0)
 *                     pair sits exactly on the regression line).
 *                     Restricting to positive pairs is the standard
 *                     denoising step for IO correlation in usage
 *                     telemetry.
 *   - meanIn:         mean of input_tokens over positivePairs.
 *   - meanOut:        mean of output_tokens over positivePairs.
 *   - stdIn:          population stddev of input_tokens over
 *                     positivePairs.
 *   - stdOut:         population stddev of output_tokens over
 *                     positivePairs.
 *   - r:              Pearson correlation coefficient. Set to 0
 *                     when undefined (positivePairs < 2 OR either
 *                     stddev == 0); the `degenerate` flag surfaces
 *                     this case so callers don't read a 0 as a
 *                     genuine "no association" finding.
 *   - degenerate:     true iff positivePairs < 2 OR stdIn == 0 OR
 *                     stdOut == 0. r is reported as 0 in the
 *                     degenerate case for JSON shape stability.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite hour_start.
 *   3. Per-source: tally rows; for each row, treat input and
 *      output tokens as 0 if non-finite or negative.
 *      Accumulate (in, out) into a per-source vector iff both > 0.
 *   4. Compute means, stds, and r per source.
 *   5. Apply display gates `--min-rows` (default 3),
 *      `--min-positive-pairs` (default 2; reserved for refinement
 *      to raise to a meaningful sample-size floor).
 *   6. Sort, then optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - rows == 0: source not registered; no entry.
 *   - positivePairs == 0: r reported as 0, degenerate=true.
 *   - positivePairs == 1: r reported as 0, degenerate=true (single
 *     point has no variance).
 *   - stdIn == 0 OR stdOut == 0: r reported as 0, degenerate=true.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort is deterministic with `source` asc as the final tiebreak.
 */
import type { QueueLine } from './types.js';

export interface SourceInputOutputCorrelationCoefficientOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many kept rows from the
   * per-source table. Display filter only — global denominators
   * reflect the full kept population. Suppressed rows surface as
   * `droppedBelowMinRows`. Must be a positive integer. Default 3.
   */
  minRows?: number;
  /**
   * Drop sources with fewer than this many positive pairs (rows
   * with both input>0 and output>0) from the per-source table.
   * Suppressed rows surface as `droppedBelowMinPositivePairs`.
   * Must be a positive integer >= 2 (Pearson r needs >=2 samples).
   * Default 2 (the minimum that makes r defined; refinement may
   * raise this).
   */
  minPositivePairs?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null
   * = no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'r-desc' (default): r descending (most positively correlated first).
   *   - 'r-asc':            r ascending (most negative or near-zero first).
   *   - 'abs-r':            |r| descending (strongest association first).
   *   - 'positive-pairs':   positivePairs descending.
   *   - 'rows':             rows descending.
   *   - 'source':           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'r-desc' | 'r-asc' | 'abs-r' | 'positive-pairs' | 'rows' | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceInputOutputCorrelationCoefficientRow {
  source: string;
  rows: number;
  positivePairs: number;
  meanIn: number;
  meanOut: number;
  stdIn: number;
  stdOut: number;
  r: number;
  /**
   * True iff r is mathematically undefined (positivePairs < 2 OR
   * stdIn == 0 OR stdOut == 0). r is reported as 0 in this case.
   */
  degenerate: boolean;
}

export interface SourceInputOutputCorrelationCoefficientReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minPositivePairs: number;
  top: number | null;
  sort: 'r-desc' | 'r-asc' | 'abs-r' | 'positive-pairs' | 'rows' | 'source';
  /** Distinct sources seen pre-filter. */
  totalSources: number;
  /** Sum of all kept rows across all sources. */
  totalRows: number;
  /** Sum of positive-pairs across all sources. */
  totalPositivePairs: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinPositivePairs: number;
  droppedBelowTopCap: number;
  sources: SourceInputOutputCorrelationCoefficientRow[];
}

export function buildSourceInputOutputCorrelationCoefficient(
  queue: QueueLine[],
  opts: SourceInputOutputCorrelationCoefficientOptions = {},
): SourceInputOutputCorrelationCoefficientReport {
  const minRows = opts.minRows ?? 3;
  if (!Number.isInteger(minRows) || minRows < 1) {
    throw new Error(
      `minRows must be a positive integer (got ${opts.minRows})`,
    );
  }
  const minPositivePairs = opts.minPositivePairs ?? 2;
  if (!Number.isInteger(minPositivePairs) || minPositivePairs < 2) {
    throw new Error(
      `minPositivePairs must be an integer >= 2 (got ${opts.minPositivePairs})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'r-desc';
  const validSorts = [
    'r-desc',
    'r-asc',
    'abs-r',
    'positive-pairs',
    'rows',
    'source',
  ];
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

  interface Bucket {
    rows: number;
    ins: number[];
    outs: number[];
  }
  const perSource = new Map<string, Bucket>();

  let droppedInvalidHourStart = 0;
  let droppedSourceFilter = 0;

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

    const inRaw = Number(q.input_tokens);
    const inTok = Number.isFinite(inRaw) && inRaw > 0 ? inRaw : 0;
    const outRaw = Number(q.output_tokens);
    const outTok = Number.isFinite(outRaw) && outRaw > 0 ? outRaw : 0;

    let b = perSource.get(source);
    if (!b) {
      b = { rows: 0, ins: [], outs: [] };
      perSource.set(source, b);
    }
    b.rows += 1;
    if (inTok > 0 && outTok > 0) {
      b.ins.push(inTok);
      b.outs.push(outTok);
    }
  }

  const totalSources = perSource.size;
  let totalRows = 0;
  let totalPositivePairs = 0;
  const allRows: SourceInputOutputCorrelationCoefficientRow[] = [];

  for (const [source, b] of perSource.entries()) {
    totalRows += b.rows;
    const n = b.ins.length;
    totalPositivePairs += n;
    let meanIn = 0;
    let meanOut = 0;
    let stdIn = 0;
    let stdOut = 0;
    let r = 0;
    let degenerate = false;
    if (n < 2) {
      degenerate = true;
    } else {
      let sumIn = 0;
      let sumOut = 0;
      for (let i = 0; i < n; i += 1) {
        sumIn += b.ins[i]!;
        sumOut += b.outs[i]!;
      }
      meanIn = sumIn / n;
      meanOut = sumOut / n;
      let sxx = 0;
      let syy = 0;
      let sxy = 0;
      for (let i = 0; i < n; i += 1) {
        const dx = b.ins[i]! - meanIn;
        const dy = b.outs[i]! - meanOut;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
      }
      stdIn = Math.sqrt(sxx / n);
      stdOut = Math.sqrt(syy / n);
      if (sxx === 0 || syy === 0) {
        degenerate = true;
      } else {
        r = sxy / Math.sqrt(sxx * syy);
        // Numerical clamp — float drift can push r marginally past
        // [-1, +1] on extreme inputs.
        if (r > 1) r = 1;
        else if (r < -1) r = -1;
      }
    }

    allRows.push({
      source,
      rows: b.rows,
      positivePairs: n,
      meanIn,
      meanOut,
      stdIn,
      stdOut,
      r,
      degenerate,
    });
  }

  let droppedBelowMinRows = 0;
  let droppedBelowMinPositivePairs = 0;
  const survived: SourceInputOutputCorrelationCoefficientRow[] = [];
  for (const row of allRows) {
    if (row.rows < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    if (row.positivePairs < minPositivePairs) {
      droppedBelowMinPositivePairs += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'r-desc') primary = b.r - a.r;
    else if (sort === 'r-asc') primary = a.r - b.r;
    else if (sort === 'abs-r') primary = Math.abs(b.r) - Math.abs(a.r);
    else if (sort === 'positive-pairs')
      primary = b.positivePairs - a.positivePairs;
    else if (sort === 'rows') primary = b.rows - a.rows;
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
    minPositivePairs,
    top,
    sort,
    totalSources,
    totalRows,
    totalPositivePairs,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinPositivePairs,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
