/**
 * daily-token-hampel-outlier-count: per-source count of daily
 * total-token values whose deviation from the source's own MEDIAN
 * exceeds `k * 1.4826 * MAD` -- the canonical Hampel-filter
 * outlier criterion applied at GLOBAL scale to the source's
 * gap-filled daily token series.
 *
 * For each source, on the gap-filled tenure series x[]:
 *
 *     med  = median(x[])                      (population median)
 *     mad  = median( |x[i] - med| )           (median absolute dev.)
 *     sig  = 1.4826 * mad                     (consistent estimator
 *                                              of population stddev
 *                                              under Gaussian)
 *     hi   = med + k * sig
 *     lo   = med - k * sig
 *     nHigh = | { i : x[i] > hi } |           (strict)
 *     nLow  = | { i : x[i] < lo } |
 *     nOut  = nHigh + nLow
 *     outFraction         = nOut / nFilled
 *     maxScore            = max_i (|x[i] - med| / sig)
 *     argMaxScoreDay      = day achieving maxScore (earliest tie)
 *
 * Why this is structurally orthogonal to every prior axis (axis-152,
 * not a duplicate of any existing measurement):
 *
 *   - `daily-token-zscore-extremes` (axis-100s) uses *MEAN* and
 *     *POPULATION STDDEV* -- both NON-ROBUST: a single huge spike
 *     PULLS the mean up AND inflates the stddev, so the threshold
 *     widens around the spike and the spike often escapes its own
 *     detector. Hampel uses MEDIAN and MAD: the spike does NOT move
 *     the median (50% breakdown) and barely moves MAD (50% breakdown).
 *     The two axes can DISAGREE on the same series and that
 *     disagreement is the structural value.
 *   - `daily-token-allan-deviation` / `hadamardDev` (axis-151):
 *     first-difference RMS, sensitive to ORDER. Hampel is ORDER-
 *     INVARIANT (median + MAD survive any permutation).
 *   - `daily-token-zenga`, `gini`, `pietra`, `atkinson`, `theil-l/t`,
 *     `ge2`, `palma`, `hoover`, `bonferroni`, `kolm-pollak`, `mehran`,
 *     `wolfson`, `chakravarty`, `fgt`, `amato`, `esteban-ray`,
 *     `foster-wolfson`, `var-of-logs`, `hill-tail-index`, `s-gini`,
 *     `gen-entropy-neg-one`, `log-mean-abs-dev`, `ge-half`, `ge-three`,
 *     `ge-four`: continuous SCALAR inequality / dispersion
 *     statistics on the whole distribution. Hampel returns an
 *     INTEGER COUNT of how many days breach a robust threshold, plus
 *     the most-extreme robust score. A series can have a moderate
 *     Gini (long-tail-but-no-spike) while having `nOut = 0`, or a
 *     low Gini (near-constant with one mega-spike) with `nOut = 1`.
 *   - `daily-token-percentile-gap-ratio` / `iqr-over-median` /
 *     `mid-spread-ratio` / `decile-share-gap` / `quintile-share-ratio`
 *     / `top-four-concentration-ratio` / `herfindahl-hirschman` /
 *     `pielou-evenness`: distribution-shape ratios; do not
 *     count threshold breaches.
 *   - `daily-token-mad-over-median` (a Hampel-style RATIO without a
 *     threshold): is a continuous dispersion scalar. Hampel-outlier-
 *     count is an INTEGER tally above a fixed multiplier of that very
 *     scale. Two series can have IDENTICAL `madOverMedian` but
 *     different `nOut` whenever one has a single huge tail spike and
 *     the other is uniformly heavy.
 *   - `daily-token-runs-test-z`, `cox-stuart`, `mann-kendall`,
 *     `difference-sign-test`, `second-diff-sign-runs`,
 *     `monotone-run-length`, `cumulative-tokens-midpoint`: trend /
 *     sign / order statistics; ignore magnitude OR are order-
 *     dependent. Hampel ignores order and uses magnitudes via robust
 *     scale.
 *   - `daily-token-spectral-*`, `dft-power-law-slope`,
 *     `permutation-entropy`, `lempel-ziv-complexity`,
 *     `sample-entropy`, `dfa-alpha`, `hurst-rs`, `hjorth-*`,
 *     `teager-kaiser-energy`, `katz-fd` etc.: frequency / complexity
 *     / fractal-dimension class. Hampel is none of these.
 *   - `daily-token-max-drawdown-rate`: peak-to-trough trajectory
 *     statistic; path-dependent. Hampel is path-INDEPENDENT (sort
 *     invariant).
 *   - `daily-token-calendar-mask-rle-entropy`,
 *     `daily-token-longest-zero-run`, `daily-token-weekend-weekday-
 *     ratio`: calendar / partition / on-off statistics. Hampel
 *     ignores calendar identity entirely; it asks only "how many
 *     daily values are robustly far from the typical day?".
 *   - `daily-token-hill-tail-index`: tail-shape exponent on the upper
 *     tail. Hampel is symmetric (high + low) and threshold-based.
 *
 * Concretely, for each source:
 *
 *   1. Aggregate per UTC calendar day (`hour_start[0..10]`):
 *      `total_tokens` summed over all rows. Days with non-positive
 *      tokens are dropped (consistent with `daily-token-allan-
 *      deviation` and `daily-token-zscore-extremes`).
 *   2. Gap-fill the tenure `[firstActiveDay, lastActiveDay]` with
 *      zeros for missing calendar days. The Hampel statistic is
 *      computed on the gap-filled series so a multi-day silence
 *      becomes legitimate "low" outlier mass.
 *   3. Compute median, MAD, sigma=1.4826*MAD, hi=med+k*sigma,
 *      lo=med-k*sigma. Count strict breaches.
 *   4. Report counts AND the single most-extreme robust score.
 *
 * Knobs:
 *   - `k` (default 3.0): outlier multiplier on `1.4826 * MAD`.
 *     The canonical "3-sigma equivalent" Hampel threshold; under
 *     a Normal distribution this is the ~99.7% rule but is
 *     ROBUST to contamination. Must be > 0.
 *   - `minDays` (default 3): structural floor on the source's
 *     gap-filled tenure length. Must be >= 3.
 *   - `top` (default 0): display cap on `sources[]` after sort.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * All sorts have explicit secondary keys (source asc).
 */
import type { QueueLine } from './types.js';

export interface DailyTokenHampelOutlierCountOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict analysis to a single source. null = no filter. */
  source?: string | null;
  /**
   * Hampel multiplier on `1.4826 * MAD`. Default 3.0 (canonical
   * 3-sigma-equivalent robust threshold). Must be a finite positive
   * number.
   */
  k?: number;
  /**
   * Minimum gap-filled tenure length (days). Must be >= 3. Default 3.
   */
  minDays?: number;
  /** Display cap on `sources[]` after sort. 0 = no cap. Default 0. */
  top?: number;
  /**
   * Sort key for the per-source table (display only).
   *   - 'tokens' (default): total tokens desc, source asc.
   *   - 'nout':             nOut desc, source asc.
   *   - 'frac':             outFraction desc, source asc.
   *   - 'maxscore':         maxScore desc, source asc.
   *   - 'ndays':            nFilledDays desc, source asc.
   */
  sort?: 'tokens' | 'nout' | 'frac' | 'maxscore' | 'meanscore' | 'asymmetry' | 'ndays';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface DailyTokenHampelOutlierCountSourceRow {
  source: string;
  /** Sum of total_tokens across all active days. */
  totalTokens: number;
  /** Distinct active calendar days (positive token mass). */
  nActiveDays: number;
  /** Gap-filled tenure length (calendar days, inclusive). */
  nFilledDays: number;
  /** Population median of the gap-filled series. */
  median: number;
  /** Median absolute deviation of the gap-filled series. */
  mad: number;
  /** sigmaHat = 1.4826 * MAD (Gaussian-consistent scale). */
  sigmaHat: number;
  /** med + k * sigmaHat. */
  hiThreshold: number;
  /** med - k * sigmaHat. */
  loThreshold: number;
  /** Count of days with x > hi (strict). */
  nHigh: number;
  /** Count of days with x < lo (strict). */
  nLow: number;
  /** nHigh + nLow. */
  nOut: number;
  /** nOut / nFilledDays. */
  outFraction: number;
  /**
   * max_i (|x[i] - median| / sigmaHat). 0 with `flat: true` when
   * sigmaHat = 0 (degenerate -- the series has a constant majority).
   */
  maxScore: number;
  /**
   * MEAN of (|x[i] - median| / sigmaHat) across all days in the
   * gap-filled series. Companion to `maxScore`: complements the
   * single-most-extreme-day reading with the AVERAGE robust
   * deviation. Two series with identical `maxScore` (one isolated
   * spike) can have wildly different `meanAbsScore` (uniformly
   * heavy vs single-spike-on-quiet-baseline). 0 with `flat: true`
   * when sigmaHat = 0.
   */
  meanAbsScore: number;
  /**
   * Asymmetry of the outlier set: (nHigh - nLow) / nOut, in
   * [-1, +1]. +1 = all outliers are HIGH (heavy spikes), -1 =
   * all outliers are LOW (anomalous quiet days), 0 = balanced
   * mix. 0 with `flatAsymmetry: true` when nOut = 0 (no
   * outliers, asymmetry undefined).
   */
  asymmetry: number;
  /** True iff asymmetry is undefined (nOut = 0) and reported as 0. */
  flatAsymmetry: boolean;
  /**
   * ISO YYYY-MM-DD of the day achieving `maxScore`. Earliest day
   * on tie. null when flat.
   */
  argMaxScoreDay: string | null;
  /** True iff sigmaHat = 0 (MAD = 0) and scores/thresholds are degenerate. */
  flat: boolean;
  /** ISO YYYY-MM-DD of first active day. */
  firstActiveDay: string;
  /** ISO YYYY-MM-DD of last active day. */
  lastActiveDay: string;
}

export interface DailyTokenHampelOutlierCountReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  k: number;
  minDays: number;
  top: number;
  sort: 'tokens' | 'nout' | 'frac' | 'maxscore' | 'meanscore' | 'asymmetry' | 'ndays';
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedTopSources: number;
  sources: DailyTokenHampelOutlierCountSourceRow[];
}

/**
 * Population median (lower-of-two-middles for even n; we use the
 * standard average-of-two-middles convention to match `daily-token-
 * mad-over-median`).
 */
export function populationMedian(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = n >> 1;
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Median Absolute Deviation around the (population) median.
 * Returns 0 when n === 0.
 */
export function medianAbsoluteDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const med = populationMedian(values);
  const dev = values.map((v) => Math.abs(v - med));
  return populationMedian(dev);
}

/**
 * Hampel filter summary for a single series. Returns the counts and
 * the maximum robust score in one pass after the median / MAD pass.
 */
export function hampelOutlierSummary(
  values: number[],
  k: number,
): {
  median: number;
  mad: number;
  sigmaHat: number;
  hi: number;
  lo: number;
  nHigh: number;
  nLow: number;
  nOut: number;
  maxScore: number;
  meanAbsScore: number;
  argMaxIndex: number;
  flat: boolean;
} {
  const n = values.length;
  if (n === 0) {
    return {
      median: 0,
      mad: 0,
      sigmaHat: 0,
      hi: 0,
      lo: 0,
      nHigh: 0,
      nLow: 0,
      nOut: 0,
      maxScore: 0,
      meanAbsScore: 0,
      argMaxIndex: -1,
      flat: true,
    };
  }
  const med = populationMedian(values);
  const mad = medianAbsoluteDeviation(values);
  const sigmaHat = 1.4826 * mad;
  if (sigmaHat === 0) {
    return {
      median: med,
      mad: 0,
      sigmaHat: 0,
      hi: med,
      lo: med,
      nHigh: 0,
      nLow: 0,
      nOut: 0,
      maxScore: 0,
      meanAbsScore: 0,
      argMaxIndex: -1,
      flat: true,
    };
  }
  const hi = med + k * sigmaHat;
  const lo = med - k * sigmaHat;
  let nHigh = 0;
  let nLow = 0;
  let maxScore = 0;
  let argMaxIndex = -1;
  let sumScore = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i]!;
    if (v > hi) nHigh += 1;
    else if (v < lo) nLow += 1;
    const score = Math.abs(v - med) / sigmaHat;
    sumScore += score;
    if (score > maxScore) {
      maxScore = score;
      argMaxIndex = i;
    }
  }
  return {
    median: med,
    mad,
    sigmaHat,
    hi,
    lo,
    nHigh,
    nLow,
    nOut: nHigh + nLow,
    maxScore,
    meanAbsScore: sumScore / n,
    argMaxIndex,
    flat: false,
  };
}

function addDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  const next = new Date(ms + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

function dayDiffInclusive(a: string, b: string): number {
  const am = Date.parse(`${a}T00:00:00.000Z`);
  const bm = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((bm - am) / 86_400_000) + 1;
}

export function buildDailyTokenHampelOutlierCount(
  queue: QueueLine[],
  opts: DailyTokenHampelOutlierCountOptions = {},
): DailyTokenHampelOutlierCountReport {
  const k = opts.k ?? 3.0;
  if (typeof k !== 'number' || !Number.isFinite(k) || k <= 0) {
    throw new Error(`k must be a finite positive number (got ${opts.k})`);
  }
  const minDays = opts.minDays ?? 3;
  if (!Number.isInteger(minDays) || minDays < 3) {
    throw new Error(`minDays must be an integer >= 3 (got ${opts.minDays})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'tokens';
  if (!['tokens', 'nout', 'frac', 'maxscore', 'meanscore', 'asymmetry', 'ndays'].includes(sort)) {
    throw new Error(
      `sort must be one of tokens|nout|frac|maxscore|meanscore|asymmetry|ndays (got ${opts.sort})`,
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

  const agg = new Map<string, Map<string, number>>();
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
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
      droppedZeroTokens += 1;
      continue;
    }

    const src = typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const day = q.hour_start.slice(0, 10);
    let days = agg.get(src);
    if (!days) {
      days = new Map<string, number>();
      agg.set(src, days);
    }
    days.set(day, (days.get(day) ?? 0) + tt);
  }

  const totalSources = agg.size;
  const rows: DailyTokenHampelOutlierCountSourceRow[] = [];
  let droppedSparseSources = 0;
  let totalTokens = 0;

  for (const [src, days] of agg) {
    const sortedKeys = Array.from(days.keys()).sort();
    const series = sortedKeys.map((d) => days.get(d)!);
    const sourceTotal = series.reduce((a, b) => a + b, 0);
    totalTokens += sourceTotal;
    const nActive = series.length;
    if (nActive === 0) continue;

    const first = sortedKeys[0]!;
    const last = sortedKeys[sortedKeys.length - 1]!;
    const nFilled = dayDiffInclusive(first, last);
    if (nFilled < minDays) {
      droppedSparseSources += 1;
      continue;
    }

    const filled: number[] = [];
    const filledDays: string[] = [];
    let cursor = first;
    for (let i = 0; i < nFilled; i++) {
      filled.push(days.get(cursor) ?? 0);
      filledDays.push(cursor);
      cursor = addDays(cursor, 1);
    }

    const summary = hampelOutlierSummary(filled, k);
    const argDay =
      summary.argMaxIndex >= 0 && summary.argMaxIndex < filledDays.length
        ? filledDays[summary.argMaxIndex]!
        : null;

    rows.push({
      source: src,
      totalTokens: sourceTotal,
      nActiveDays: nActive,
      nFilledDays: nFilled,
      median: summary.median,
      mad: summary.mad,
      sigmaHat: summary.sigmaHat,
      hiThreshold: summary.hi,
      loThreshold: summary.lo,
      nHigh: summary.nHigh,
      nLow: summary.nLow,
      nOut: summary.nOut,
      outFraction: summary.nOut / nFilled,
      maxScore: summary.maxScore,
      meanAbsScore: summary.meanAbsScore,
      asymmetry: summary.nOut === 0 ? 0 : (summary.nHigh - summary.nLow) / summary.nOut,
      flatAsymmetry: summary.nOut === 0,
      argMaxScoreDay: argDay,
      flat: summary.flat,
      firstActiveDay: first,
      lastActiveDay: last,
    });
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'nout':
        primary = b.nOut - a.nOut;
        break;
      case 'frac':
        primary = b.outFraction - a.outFraction;
        break;
      case 'maxscore':
        primary = b.maxScore - a.maxScore;
        break;
      case 'meanscore':
        primary = b.meanAbsScore - a.meanAbsScore;
        break;
      case 'asymmetry':
        primary = b.asymmetry - a.asymmetry;
        break;
      case 'ndays':
        primary = b.nFilledDays - a.nFilledDays;
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
  let kept = rows;
  if (top > 0 && rows.length > top) {
    droppedTopSources = rows.length - top;
    kept = rows.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    k,
    minDays,
    top,
    sort,
    source: sourceFilter,
    totalTokens,
    totalSources,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedTopSources,
    sources: kept,
  };
}
