/**
 * source-output-token-benford-deviation: per-source goodness-of-fit
 * of the **leading-digit distribution of `output_tokens`** to
 * Benford's law.
 *
 * Benford's law: in many natural numeric processes spanning multiple
 * orders of magnitude, the probability that the *first significant
 * decimal digit* equals d (for d in 1..9) is
 *
 *   P_benford(d) = log10(1 + 1/d)
 *
 * which gives roughly:
 *   d=1: 30.10%, d=2: 17.61%, d=3: 12.49%, d=4:  9.69%,
 *   d=5:  7.92%, d=6:  6.69%, d=7:  5.80%, d=8:  5.12%, d=9: 4.58%.
 *
 * For each source we collect the empirical first-significant-digit
 * histogram of all positive `output_tokens` values, compute the
 * expected count under Benford for the same N, and report:
 *
 *   - per-digit observed count and observed frequency
 *   - chi-square statistic
 *       chi2 = sum_{d=1..9} (O_d - E_d)^2 / E_d
 *     with 8 degrees of freedom (no fitted parameters).
 *   - mean absolute deviation (MAD) from Benford in percentage points
 *       MAD = mean_d | obs_freq_d - benford_d | * 100
 *     (Nigrini's MAD; rule of thumb thresholds:
 *       < 0.6  -> close conformity
 *       0.6 .. 1.2 -> acceptable
 *       1.2 .. 1.5 -> marginally acceptable
 *       > 1.5  -> nonconformity)
 *   - the mode digit and its observed frequency
 *
 * Why orthogonal to everything that already ships:
 *
 *   - Every existing token statistic is *magnitude-aware*: sums,
 *     percentiles, gini, z-score, autocorrelation, monotone runs,
 *     d2 sign runs, cv, entropy. They all care about how big the
 *     numbers are. Benford's leading digit is *scale-free* — it
 *     depends only on log10(x) mod 1. Multiplying every output by
 *     a constant leaves the leading-digit distribution unchanged
 *     (the chi-square is invariant under x -> c*x for c > 0).
 *   - `output-input-ratio`, `output-size`, `output-token-decile-distribution`
 *     are all order-statistics / quantile statistics of the value
 *     distribution. None of them touches the *digit structure*.
 *   - `bucket-token-gini`, `model-mix-entropy`, `hour-of-day-source-mix-entropy`
 *     are concentration / diversity statistics on weighted bins.
 *     Benford is a goodness-of-fit to a fully specified theoretical
 *     distribution on a fixed 9-bin alphabet.
 *   - Time-series statistics (`autocorrelation-lag1`, `monotone-run-length`,
 *     `second-difference-sign-runs`, `streaks`, `interarrival-time`)
 *     all depend on order; permuting the rows leaves the Benford
 *     distribution unchanged.
 *
 * Headline question:
 * **"Do this source's per-bucket output_token magnitudes look like
 *   they were drawn from a natural multi-order-of-magnitude process,
 *   or are they clipped/quantized/throttled in a way that distorts
 *   the first-significant-digit distribution?"**
 *
 * Practical reading: a high MAD or chi2 against Benford on
 * `output_tokens` is a fingerprint of *non-natural* shaping —
 * common causes in this domain are: hard token caps (truncation
 * piles up at certain leading digits), retries that produce many
 * near-identical outputs, very narrow effective range (e.g.
 * always 200-400 tokens out -> heavy 2/3 leading), or a small N
 * regime where the law just hasn't kicked in. Sources whose output
 * spans many orders of magnitude (interactive turns from terse acks
 * to multi-thousand-token plans) tend to track Benford closely.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source (others surface as
 *     `droppedSourceFilter`).
 *   - `minRows` (default 30): structural floor; need at least this
 *     many positive-output rows for Benford fit to be meaningful.
 *     Sparse sources surface as `droppedSparseSources`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`
 *     after sort. Suppressed surface as `droppedTopSources`.
 *   - `sort`: 'tokens' (default) | 'mad' | 'chi2' | 'rows' | 'source'.
 *   - `maxMad` (refinement filter, default 0 = no filter): hide
 *     sources whose MAD percent exceeds this value (i.e. show only
 *     the *closest-to-Benford* sources). Counts surface as
 *     `droppedAboveMaxMad`.
 */
import type { QueueLine } from './types.js';

export type BenfordSort = 'tokens' | 'mad' | 'chi2' | 'rows' | 'source';

export interface SourceOutputTokenBenfordDeviationOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Minimum number of positive-output_tokens rows required for the
   * source to be reported. Must be >= 9 (one per Benford bin) for
   * the chi-square to be defined; default 30 to keep results
   * reasonably informative.
   */
  minRows?: number;
  top?: number;
  sort?: BenfordSort;
  /**
   * Display filter (refinement): drop rows whose MAD percent is
   * strictly above this value. 0 = no filter.
   */
  maxMad?: number;
  generatedAt?: string;
}

export interface BenfordDigitRow {
  digit: number; // 1..9
  observed: number; // O_d
  expected: number; // E_d (real-valued, not rounded)
  observedFreq: number; // O_d / N
  expectedFreq: number; // log10(1 + 1/d)
}

export interface SourceOutputTokenBenfordDeviationSourceRow {
  source: string;
  /** Sum of total_tokens (for sort/headline display, not used in fit). */
  totalTokens: number;
  /** Number of rows contributing to the Benford fit. */
  nRows: number;
  /** Per-digit observed/expected breakdown, digit asc. */
  digits: BenfordDigitRow[];
  /** Pearson chi-square against Benford with 8 d.o.f. */
  chi2: number;
  /** Mean absolute deviation in percentage points (Nigrini MAD * 100). */
  madPercent: number;
  /** Digit (1..9) with the highest observed frequency. Earliest tie wins. */
  modeDigit: number;
  /** Observed frequency of `modeDigit`. */
  modeFreq: number;
  /** First and last UTC day contributing rows (yyyy-mm-dd). */
  firstDay: string;
  lastDay: string;
}

export interface SourceOutputTokenBenfordDeviationReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minRows: number;
  top: number;
  sort: BenfordSort;
  maxMad: number;
  source: string | null;
  /** Sum of nRows across all kept sources. */
  totalRows: number;
  /** Sum of total_tokens across all kept sources. */
  totalTokens: number;
  /** Distinct sources seen (before display filters). */
  totalSources: number;
  droppedInvalidHourStart: number;
  /** Rows whose output_tokens was non-positive or non-finite. */
  droppedNonPositiveOutput: number;
  droppedSourceFilter: number;
  /** Sources with fewer than `minRows` positive-output rows. */
  droppedSparseSources: number;
  /** Source rows hidden by the `maxMad` filter. */
  droppedAboveMaxMad: number;
  /** Source rows hidden by the `top` cap. */
  droppedTopSources: number;
  sources: SourceOutputTokenBenfordDeviationSourceRow[];
}

/** Benford expected frequency for digit d in 1..9. */
export function benfordExpectedFreq(d: number): number {
  if (!Number.isInteger(d) || d < 1 || d > 9) {
    throw new Error(`benfordExpectedFreq: digit must be int 1..9 (got ${d})`);
  }
  return Math.log10(1 + 1 / d);
}

/**
 * Extract the first significant decimal digit (1..9) of a positive
 * finite number. Returns 0 if the input is not a positive finite
 * number (caller should filter these out beforehand).
 */
export function firstSignificantDigit(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  // Strip the integer part if x >= 1, otherwise scale up.
  let v = x;
  while (v >= 10) v = v / 10;
  while (v < 1) v = v * 10;
  const d = Math.floor(v);
  // floor of [1,10) is in [1,9]; clamp defensively.
  if (d < 1) return 1;
  if (d > 9) return 9;
  return d;
}

export function buildSourceOutputTokenBenfordDeviation(
  queue: QueueLine[],
  opts: SourceOutputTokenBenfordDeviationOptions = {},
): SourceOutputTokenBenfordDeviationReport {
  const minRows = opts.minRows ?? 30;
  if (!Number.isInteger(minRows) || minRows < 9) {
    throw new Error(`minRows must be an integer >= 9 (got ${opts.minRows})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const maxMad = opts.maxMad ?? 0;
  if (!Number.isFinite(maxMad) || maxMad < 0) {
    throw new Error(`maxMad must be a non-negative number (got ${opts.maxMad})`);
  }
  const sort: BenfordSort = opts.sort ?? 'tokens';
  const validSorts: BenfordSort[] = ['tokens', 'mad', 'chi2', 'rows', 'source'];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
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
    counts: number[]; // index 0 unused; 1..9
    nRows: number;
    totalTokens: number;
    firstDay: string;
    lastDay: string;
  }
  const agg = new Map<string, SrcAcc>();
  let droppedInvalidHourStart = 0;
  let droppedNonPositiveOutput = 0;
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;
    const out = Number(q.output_tokens);
    if (!Number.isFinite(out) || out <= 0) {
      droppedNonPositiveOutput += 1;
      continue;
    }
    const src =
      typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }
    const d = firstSignificantDigit(out);
    if (d < 1 || d > 9) continue; // defensive; firstSignificantDigit clamps
    const day = q.hour_start.slice(0, 10);
    let acc = agg.get(src);
    if (!acc) {
      acc = {
        counts: new Array(10).fill(0),
        nRows: 0,
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, acc);
    }
    acc.counts[d] = (acc.counts[d] ?? 0) + 1;
    acc.nRows += 1;
    const tt = Number(q.total_tokens);
    if (Number.isFinite(tt) && tt > 0) acc.totalTokens += tt;
    if (day < acc.firstDay) acc.firstDay = day;
    if (day > acc.lastDay) acc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let totalRows = 0;
  let totalTokensSum = 0;
  const rows: SourceOutputTokenBenfordDeviationSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.nRows < minRows) {
      droppedSparseSources += 1;
      continue;
    }
    const N = acc.nRows;
    const digits: BenfordDigitRow[] = [];
    let chi2 = 0;
    let madSum = 0;
    let modeDigit = 1;
    let modeCount = -1;
    for (let d = 1; d <= 9; d++) {
      const obs = acc.counts[d]!;
      const expFreq = benfordExpectedFreq(d);
      const exp = expFreq * N;
      const obsFreq = obs / N;
      digits.push({
        digit: d,
        observed: obs,
        expected: exp,
        observedFreq: obsFreq,
        expectedFreq: expFreq,
      });
      if (exp > 0) {
        const diff = obs - exp;
        chi2 += (diff * diff) / exp;
      }
      madSum += Math.abs(obsFreq - expFreq);
      if (obs > modeCount) {
        modeCount = obs;
        modeDigit = d;
      }
    }
    const madPercent = (madSum / 9) * 100;
    const modeFreq = modeCount / N;

    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nRows: N,
      digits,
      chi2,
      madPercent,
      modeDigit,
      modeFreq,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
    });
    totalRows += N;
    totalTokensSum += acc.totalTokens;
  }

  // maxMad refinement filter
  let droppedAboveMaxMad = 0;
  let filtered = rows;
  if (maxMad > 0) {
    const next: SourceOutputTokenBenfordDeviationSourceRow[] = [];
    for (const r of rows) {
      if (r.madPercent <= maxMad) next.push(r);
      else droppedAboveMaxMad += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'mad':
        primary = b.madPercent - a.madPercent;
        break;
      case 'chi2':
        primary = b.chi2 - a.chi2;
        break;
      case 'rows':
        primary = b.nRows - a.nRows;
        break;
      case 'source':
        primary = 0;
        break;
      case 'tokens':
      default:
        primary = b.totalTokens - a.totalTokens;
        break;
    }
    if (primary !== 0) return primary;
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
    minRows,
    top,
    sort,
    maxMad,
    source: sourceFilter,
    totalRows,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveOutput,
    droppedSourceFilter,
    droppedSparseSources,
    droppedAboveMaxMad,
    droppedTopSources,
    sources: kept,
  };
}
