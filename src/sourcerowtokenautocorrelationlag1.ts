/**
 * source-row-token-autocorrelation-lag1: per-source lag-1 (Pearson)
 * autocorrelation of `total_tokens` across the source's *queue rows*,
 * ordered by `hour_start` ascending (then `model` asc, then
 * `device_id` asc as deterministic tiebreaks).
 *
 * Headline question: **for each source, do consecutive queue rows
 * have similar `total_tokens` (sticky / persistent producer) or
 * effectively independent token sizes (white-noise producer)?**
 *
 * Why this is genuinely orthogonal to existing lenses:
 *
 *   - `daily-token-autocorrelation-lag1` is **day-grain** and
 *     workspace-wide-or-per-source on aggregated daily totals; it
 *     cannot see within-day stickiness (every row of a 50-row day
 *     collapses to one daily total). This lens is **row-grain**:
 *     adjacent calls inside the same hour count.
 *   - `source-row-token-coefficient-of-variation`,
 *     `source-row-token-mad`, `source-row-token-gini`,
 *     `source-row-token-skewness`, `source-row-token-kurtosis` all
 *     describe the **marginal distribution** of per-row tokens
 *     (population shape). They are blind to **ordering**: shuffling
 *     a source's rows leaves all of them unchanged but would zero
 *     out lag-1 autocorrelation.
 *   - `source-same-model-streak`, `model-switching`,
 *     `provider-switching-frequency` are **categorical** stickiness
 *     (which model is sticky), not **numerical** stickiness of the
 *     row's token magnitude.
 *   - `source-input-output-correlation-coefficient` is a
 *     cross-axis (input vs output) Pearson on *the same row*; this
 *     is a same-axis (total_tokens vs total_tokens) Pearson on
 *     *adjacent rows*. The two are mathematically unrelated.
 *   - `interarrival-time` and `source-gap-hours-cv` describe gap
 *     spacing, not the value persistence of the magnitude itself.
 *
 * Concretely, for each source:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start` (counted in
 *      `droppedInvalidHourStart`).
 *   3. Drop rows with non-finite `total_tokens` (counted in
 *      `droppedInvalidTokens`).
 *   4. Group remaining rows by source.
 *   5. Per source: sort by `hour_start` asc, then `model` asc, then
 *      `device_id` asc as deterministic tiebreaks. Extract the
 *      `total_tokens` series `x[0..n-1]`.
 *   6. Skip sources with `n < minRows` (default 3 — need at least 2
 *      adjacent pairs for a meaningful Pearson).
 *   7. Compute mean `mu = (1/n) sum x[i]` and centred sums.
 *   8. lag-1 Pearson autocorrelation (biased divisor — matches
 *      `numpy.correlate` / `statsmodels.acf` defaults):
 *
 *        rho1 = sum_{i=0}^{n-2} (x[i] - mu) * (x[i+1] - mu)
 *               / sum_{i=0}^{n-1} (x[i] - mu)^2
 *
 *      In `[-1, 1]` for centred Pearson on a finite series. When
 *      the denominator is 0 (constant series — every row has the
 *      same total_tokens) `rho1` is reported as 0 with `flat: true`
 *      so the operator can distinguish "literally undefined" from
 *      "noisy zero".
 *   9. Apply display gates `--min-rows`, `--min-abs-rho` (cohort
 *      filter for sources with non-trivial absolute autocorrelation
 *      — drops both rho1 ~ 0 sources and `flat: true` sources).
 *  10. Sort + optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - `n < 2`: no pairs, rho1 undefined; surfaces as
 *     `droppedBelowMinRows` (`minRows >= 3`).
 *   - All-equal series (`var(x) = 0`): `rho1 = 0`, `flat = true`.
 *     The interpretation is "no variation to correlate"; this is
 *     mathematically distinct from "noisy white-noise rho1 ~ 0"
 *     and the flag preserves that distinction.
 *   - Two-row source (`n = 2`): one pair, rho1 is mathematically
 *     `(x0-mu)(x1-mu)/((x0-mu)^2 + (x1-mu)^2) = -0.5` for any two
 *     distinct values (centred 2-point series is anti-symmetric).
 *     This pathological constant is exactly why `minRows` defaults
 *     to 3.
 *   - Negative `total_tokens` — possible only if upstream feed
 *     emits invalid data. Treated as valid for the autocorrelation
 *     (Pearson is sign-invariant up to translation); only NaN/Inf
 *     are dropped.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak in all sort modes is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenAutocorrelationLag1Options {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many kept rows. Display
   * filter only — global denominators reflect the full kept
   * population. Must be >= 3 (need >= 2 adjacent pairs for a
   * Pearson that isn't pathologically constrained). Default 3.
   */
  minRows?: number;
  /**
   * Drop sources whose `|rho1|` is strictly below this value;
   * cohort selector for sources with non-trivial autocorrelation
   * in either direction. Drops `flat: true` sources too (their
   * rho1 is reported as 0). Must be in `[0, 1]`. Default 0
   * (no floor; preserves all sources with `rowsKept >= minRows`).
   */
  minAbsRho?: number;
  /**
   * Drop sources whose `mean` total_tokens is strictly below
   * this value; cohort selector that gates out "tiny producer
   * noise" — sources whose row magnitudes are so small that
   * even a strong autocorrelation signal carries little
   * absolute mass. Orthogonal to `minAbsRho`: a source can
   * have mean=5K and rho1=0.95 (tiny but sticky, gated by
   * minMean) or mean=10M and rho1=0.05 (huge but white-noise,
   * gated by minAbsRho). Must be a finite, non-negative number.
   * Default 0 (no floor).
   */
  minMean?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'rho-desc' (default): rho1 descending (most-positive
   *                           persistent first).
   *   - 'rho-asc':            rho1 ascending (most-negative
   *                           anti-persistent first).
   *   - 'abs-rho-desc':       |rho1| descending (any direction).
   *   - 'rows':               rowsKept desc.
   *   - 'mean':               mean total_tokens desc.
   *   - 'source':             source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'rho-desc'
    | 'rho-asc'
    | 'abs-rho-desc'
    | 'rows'
    | 'mean'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenAutocorrelationLag1Row {
  source: string;
  rowsKept: number;
  pairs: number;
  mean: number;
  variance: number;
  rho1: number;
  flat: boolean;
}

export interface SourceRowTokenAutocorrelationLag1Report {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minAbsRho: number;
  minMean: number;
  top: number | null;
  sort:
    | 'rho-desc'
    | 'rho-asc'
    | 'abs-rho-desc'
    | 'rows'
    | 'mean'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinAbsRho: number;
  droppedBelowMinMean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenAutocorrelationLag1Row[];
}

const VALID_SORTS = [
  'rho-desc',
  'rho-asc',
  'abs-rho-desc',
  'rows',
  'mean',
  'source',
] as const;

export function buildSourceRowTokenAutocorrelationLag1(
  queue: QueueLine[],
  opts: SourceRowTokenAutocorrelationLag1Options = {},
): SourceRowTokenAutocorrelationLag1Report {
  const minRows = opts.minRows ?? 3;
  if (!Number.isInteger(minRows) || minRows < 3) {
    throw new Error(
      `minRows must be an integer >= 3 (got ${opts.minRows})`,
    );
  }
  const minAbsRho = opts.minAbsRho ?? 0;
  if (!Number.isFinite(minAbsRho) || minAbsRho < 0 || minAbsRho > 1) {
    throw new Error(
      `minAbsRho must be a finite number in [0, 1] (got ${opts.minAbsRho})`,
    );
  }
  const minMean = opts.minMean ?? 0;
  if (!Number.isFinite(minMean) || minMean < 0) {
    throw new Error(
      `minMean must be a finite, non-negative number (got ${opts.minMean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'rho-desc';
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

  // Per-source: array of [hour_start_ms, model, device_id, total_tokens].
  const perSource = new Map<string, Array<[number, string, string, number]>>();

  let droppedInvalidHourStart = 0;
  let droppedInvalidTokens = 0;
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const tt = q.total_tokens;
    if (typeof tt !== 'number' || !Number.isFinite(tt)) {
      droppedInvalidTokens += 1;
      continue;
    }

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }
    const model =
      typeof q.model === 'string' && q.model !== '' ? q.model : 'unknown';
    const dev =
      typeof q.device_id === 'string' && q.device_id !== ''
        ? q.device_id
        : 'unknown';

    let arr = perSource.get(source);
    if (!arr) {
      arr = [];
      perSource.set(source, arr);
    }
    arr.push([ms, model, dev, tt]);
  }

  const totalSources = perSource.size;
  let totalRowsKept = 0;
  const allRows: SourceRowTokenAutocorrelationLag1Row[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    // Sort by hour_start asc, then model asc, then device asc as
    // deterministic tiebreaks.
    samples.sort((a, b) => {
      if (a[0] !== b[0]) return a[0] - b[0];
      if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
      if (a[2] !== b[2]) return a[2] < b[2] ? -1 : 1;
      return 0;
    });

    // Extract the total_tokens series.
    const x = samples.map((s) => s[3]);

    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += x[i]!;
    const mean = sum / n;

    let denom = 0;
    for (let i = 0; i < n; i += 1) {
      const d = x[i]! - mean;
      denom += d * d;
    }
    const variance = denom / n;

    let numer = 0;
    for (let i = 0; i < n - 1; i += 1) {
      numer += (x[i]! - mean) * (x[i + 1]! - mean);
    }

    let rho1: number;
    let flat: boolean;
    if (denom === 0) {
      rho1 = 0;
      flat = true;
    } else {
      rho1 = numer / denom;
      flat = false;
      // Numerical clamp: floating-point can produce 1.0000000001 etc.
      if (rho1 > 1) rho1 = 1;
      else if (rho1 < -1) rho1 = -1;
    }

    allRows.push({
      source,
      rowsKept: n,
      pairs: n - 1,
      mean,
      variance,
      rho1,
      flat,
    });
  }

  let droppedBelowMinAbsRho = 0;
  let droppedBelowMinMean = 0;
  const survived: SourceRowTokenAutocorrelationLag1Row[] = [];
  for (const row of allRows) {
    if (Math.abs(row.rho1) < minAbsRho) {
      droppedBelowMinAbsRho += 1;
      continue;
    }
    if (row.mean < minMean) {
      droppedBelowMinMean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'rho-desc') primary = b.rho1 - a.rho1;
    else if (sort === 'rho-asc') primary = a.rho1 - b.rho1;
    else if (sort === 'abs-rho-desc')
      primary = Math.abs(b.rho1) - Math.abs(a.rho1);
    else if (sort === 'rows') primary = b.rowsKept - a.rowsKept;
    else if (sort === 'mean') primary = b.mean - a.mean;
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
    minAbsRho,
    minMean,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinAbsRho,
    droppedBelowMinMean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
