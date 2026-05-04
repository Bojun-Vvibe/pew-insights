/**
 * daily-token-cusum-max-deviation: per-source CUSUM (cumulative sum)
 * max excursion above and below the running mean on the gap-filled
 * daily total_tokens series.
 *
 * For each source, on the gap-filled tenure series x[0..n-1]:
 *
 *     mu       = (1/n) * sum_i x[i]                  (sample mean)
 *     d[i]     = x[i] - mu                           (deviations)
 *     S[i]     = sum_{j<=i} d[j]                     (CUSUM, S[-1]=0)
 *
 *     cusumMax = max_i S[i]                          (positive excursion)
 *     cusumMin = min_i S[i]                          (negative excursion)
 *     cusumRange = cusumMax - cusumMin               (path span)
 *
 *     rms      = sqrt( (1/n) * sum_i d[i]^2 )        (population stdev)
 *     normMax  = cusumMax / (rms * sqrt(n))          (normalized; ~ N(0,1)
 *                                                     scale under iid noise)
 *     normMin  = cusumMin / (rms * sqrt(n))
 *     normRange = cusumRange / (rms * sqrt(n))
 *
 *     argMaxDay = day achieving cusumMax (earliest tie)
 *     argMinDay = day achieving cusumMin (earliest tie)
 *
 * Why this is structurally orthogonal to every prior axis (axis-152 was
 * Hampel point-outlier counts; axis-151 was Allan deviation; axis-150
 * was isoweek-DOW entropy; etc.):
 *
 *   - axis-152 (Hampel outlier count): POINT-WISE robust deviation
 *     count; ORDER-INVARIANT (sort the series, identical answer). CUSUM
 *     is INTEGRATED and STRICTLY ORDER-DEPENDENT: reversing the series
 *     mirrors S[i] across zero. Hampel cannot detect drift; CUSUM is
 *     the canonical drift / mean-shift / changepoint detector.
 *   - axis-151 (Allan deviation): RMS of FIRST DIFFERENCES (step
 *     volatility class). Allan ignores cumulative drift entirely — a
 *     monotone ramp has small Allan dev (small steps) but a HUGE CUSUM
 *     range. Two series with identical Allan dev can have wildly
 *     different CUSUM signatures.
 *   - daily-token-autocorrelation-lag1 / lag7 / kendall / spearman:
 *     LINEAR DEPENDENCE between adjacent / lagged points. CUSUM is a
 *     PATH integral; an AR(1) series and a step-shift series can have
 *     identical lag-1 autocorrelation but very different cusumRange.
 *   - daily-token-monotone-run-length: longest strictly-monotone run;
 *     a TRAJECTORY-shape integer count. CUSUM is a real-valued path
 *     integral. A series can have short monotone runs but large CUSUM
 *     drift (oscillating but with positive bias).
 *   - daily-token-zscore-extremes / mad-over-median / iqr-over-median
 *     / hampel: SCALE / DISPERSION / OUTLIER statistics on the
 *     marginal distribution. CUSUM is a PATH STATISTIC: it sees ORDER.
 *   - daily-token-{gini,atkinson,theil-l/t,zenga,pietra,palma,hoover,
 *     bonferroni,kolm-pollak,mehran,wolfson,chakravarty,fgt,amato,
 *     esteban-ray,foster-wolfson,var-of-logs,hill-tail-index,s-gini,
 *     gen-entropy-neg-one,log-mean-abs-dev,ge-half,ge-three,ge-four}:
 *     all SORT-INVARIANT inequality scalars on the marginal. CUSUM is
 *     none of these.
 *   - daily-token-spectral-* / dft-power-law-slope / permutation-
 *     entropy / lempel-ziv / sample-entropy / dfa-alpha / hurst-rs /
 *     hjorth-* / teager-kaiser / katz-fd / higuchi-fd / petrosian-fd /
 *     sevcik-fd / box-count-fd: frequency / complexity / fractal
 *     dimension class. CUSUM is a single integrated path statistic,
 *     not a frequency or complexity measure.
 *   - daily-token-runs-test-z / cox-stuart / mann-kendall / difference-
 *     sign-test / second-diff-sign-runs / bartels-rank-vonneumann:
 *     SIGN / RANK trend tests; ignore magnitudes. CUSUM uses
 *     magnitudes (deviations from mean) and accumulates them.
 *   - daily-token-max-drawdown-rate: peak-to-trough trajectory
 *     statistic on the LEVELS x[i]. CUSUM is the trajectory of
 *     CENTERED levels (x[i] - mu); a series whose levels are all
 *     positive and rising has zero drawdown but large positive CUSUM
 *     excursion.
 *   - daily-token-cumulative-tokens-midpoint: WHERE in calendar time
 *     the cumulative-mass midpoint (50%) is reached on the LEVELS.
 *     CUSUM is on the DEVIATIONS and exposes the worst positive AND
 *     worst negative drift, not a percentile of mass.
 *   - daily-token-calendar-mask-rle-entropy / longest-zero-run /
 *     weekend-weekday-ratio / month-end-vs-month-start-ratio /
 *     isoweek-dow entropy: calendar / partition / mask statistics.
 *     CUSUM ignores calendar identity entirely.
 *
 * Concretely, for each source:
 *
 *   1. Aggregate per UTC calendar day: sum total_tokens. Drop days
 *      with non-positive tokens (consistent with axis-151 / axis-152).
 *   2. Gap-fill the tenure [firstActiveDay, lastActiveDay] with zeros.
 *      CUSUM is computed on this gap-filled series so silences are
 *      legitimate negative drift mass.
 *   3. Compute mu, then d[i], then the running CUSUM. Track the
 *      running max and min of S[i] and the indices that achieve them.
 *   4. Compute rms over d[i]; normalize cusumMax/Min/Range by
 *      rms * sqrt(n) to give a unitless drift-strength score
 *      comparable across sources.
 *
 * Knobs:
 *   - `minDays` (default 3): structural floor on gap-filled tenure.
 *   - `top` (default 0): display cap.
 *   - `sort`: tokens|max|min|range|normmax|normmin|normrange|ndays.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * All sorts have explicit secondary keys (source asc).
 */
import type { QueueLine } from './types.js';

export type DailyTokenCusumMaxDeviationSortKey =
  | 'tokens'
  | 'max'
  | 'min'
  | 'range'
  | 'normmax'
  | 'normmin'
  | 'normrange'
  | 'driftindex'
  | 'absdriftindex'
  | 'ndays';

export interface DailyTokenCusumMaxDeviationOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Minimum gap-filled tenure length (days). Must be >= 3. Default 3. */
  minDays?: number;
  /** Display cap on `sources[]` after sort. 0 = no cap. Default 0. */
  top?: number;
  sort?: DailyTokenCusumMaxDeviationSortKey;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface DailyTokenCusumMaxDeviationSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nFilledDays: number;
  /** Sample mean of the gap-filled series. */
  mean: number;
  /** Population RMS of the centered series d[i] = x[i] - mean. */
  rms: number;
  /** max_i S[i]. Always >= 0 (S[-1] = 0 is implicit). */
  cusumMax: number;
  /** min_i S[i]. Always <= 0. */
  cusumMin: number;
  /** cusumMax - cusumMin (always >= 0). */
  cusumRange: number;
  /** cusumMax / (rms * sqrt(n)). 0 with `flat: true` when rms = 0. */
  normMax: number;
  /** cusumMin / (rms * sqrt(n)). 0 with `flat: true` when rms = 0. */
  normMin: number;
  /** cusumRange / (rms * sqrt(n)). 0 with `flat: true` when rms = 0. */
  normRange: number;
  /**
   * Signed net-drift index: (cusumMax + cusumMin) / (rms * sqrt(n)).
   * Captures NET drift direction independent of path span.
   *   - > 0: net upward drift (positive excursion dominates trough)
   *   - < 0: net downward drift (trough dominates positive excursion)
   *   -   0: balanced excursions
   * Distinct from normRange (which measures path SPAN, sign-blind).
   * Two series with identical normRange can have driftIndex of
   * +1 (pure upswing) vs -1 (pure downswing) vs 0 (V-shape).
   * 0 with `flat: true` when rms = 0.
   */
  driftIndex: number;
  /** ISO YYYY-MM-DD of the day achieving cusumMax. null when flat. */
  argMaxDay: string | null;
  /** ISO YYYY-MM-DD of the day achieving cusumMin. null when flat. */
  argMinDay: string | null;
  /** True iff rms = 0 (constant series) and norms are degenerate. */
  flat: boolean;
  firstActiveDay: string;
  lastActiveDay: string;
}

export interface DailyTokenCusumMaxDeviationReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minDays: number;
  top: number;
  sort: DailyTokenCusumMaxDeviationSortKey;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedTopSources: number;
  sources: DailyTokenCusumMaxDeviationSourceRow[];
}

export interface CusumSummary {
  mean: number;
  rms: number;
  cusumMax: number;
  cusumMin: number;
  cusumRange: number;
  normMax: number;
  normMin: number;
  normRange: number;
  driftIndex: number;
  argMaxIndex: number;
  argMinIndex: number;
  flat: boolean;
}

/**
 * Pure CUSUM summary on a real-valued series. Returns max and min
 * cumulative excursion of (x[i] - mean(x)) and their normalized
 * forms (divided by rms * sqrt(n)).
 */
export function cusumSummary(values: number[]): CusumSummary {
  const n = values.length;
  if (n === 0) {
    return {
      mean: 0,
      rms: 0,
      cusumMax: 0,
      cusumMin: 0,
      cusumRange: 0,
      normMax: 0,
      normMin: 0,
      normRange: 0,
      driftIndex: 0,
      argMaxIndex: -1,
      argMinIndex: -1,
      flat: true,
    };
  }
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i]!;
  const mean = sum / n;
  let sumSq = 0;
  let s = 0;
  let cusumMax = 0;
  let cusumMin = 0;
  let argMaxIndex = -1;
  let argMinIndex = -1;
  for (let i = 0; i < n; i++) {
    const d = values[i]! - mean;
    sumSq += d * d;
    s += d;
    if (argMaxIndex === -1 || s > cusumMax) {
      cusumMax = s;
      argMaxIndex = i;
    }
    if (argMinIndex === -1 || s < cusumMin) {
      cusumMin = s;
      argMinIndex = i;
    }
  }
  const rms = Math.sqrt(sumSq / n);
  if (rms === 0) {
    return {
      mean,
      rms: 0,
      cusumMax: 0,
      cusumMin: 0,
      cusumRange: 0,
      normMax: 0,
      normMin: 0,
      normRange: 0,
      driftIndex: 0,
      argMaxIndex: -1,
      argMinIndex: -1,
      flat: true,
    };
  }
  // Re-init max/min so a constant series does not pin index 0.
  // Above loop already gives correct cusumMax/Min when not flat.
  // Ensure cusumMax >= 0 and cusumMin <= 0 (they should be by construction
  // because S[n-1] = 0 and we initialize argMax/Min on first iter only).
  if (cusumMax < 0) cusumMax = 0;
  if (cusumMin > 0) cusumMin = 0;
  const cusumRange = cusumMax - cusumMin;
  const denom = rms * Math.sqrt(n);
  return {
    mean,
    rms,
    cusumMax,
    cusumMin,
    cusumRange,
    normMax: cusumMax / denom,
    normMin: cusumMin / denom,
    normRange: cusumRange / denom,
    driftIndex: (cusumMax + cusumMin) / denom,
    argMaxIndex,
    argMinIndex,
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

const SORT_KEYS: DailyTokenCusumMaxDeviationSortKey[] = [
  'tokens',
  'max',
  'min',
  'range',
  'normmax',
  'normmin',
  'normrange',
  'driftindex',
  'absdriftindex',
  'ndays',
];

export function buildDailyTokenCusumMaxDeviation(
  queue: QueueLine[],
  opts: DailyTokenCusumMaxDeviationOptions = {},
): DailyTokenCusumMaxDeviationReport {
  const minDays = opts.minDays ?? 3;
  if (!Number.isInteger(minDays) || minDays < 3) {
    throw new Error(`minDays must be an integer >= 3 (got ${opts.minDays})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'tokens';
  if (!SORT_KEYS.includes(sort)) {
    throw new Error(
      `sort must be one of ${SORT_KEYS.join('|')} (got ${opts.sort})`,
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
  const rows: DailyTokenCusumMaxDeviationSourceRow[] = [];
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

    const summary = cusumSummary(filled);
    const argMaxDay =
      summary.argMaxIndex >= 0 && summary.argMaxIndex < filledDays.length
        ? filledDays[summary.argMaxIndex]!
        : null;
    const argMinDay =
      summary.argMinIndex >= 0 && summary.argMinIndex < filledDays.length
        ? filledDays[summary.argMinIndex]!
        : null;

    rows.push({
      source: src,
      totalTokens: sourceTotal,
      nActiveDays: nActive,
      nFilledDays: nFilled,
      mean: summary.mean,
      rms: summary.rms,
      cusumMax: summary.cusumMax,
      cusumMin: summary.cusumMin,
      cusumRange: summary.cusumRange,
      normMax: summary.normMax,
      normMin: summary.normMin,
      normRange: summary.normRange,
      driftIndex: summary.driftIndex,
      argMaxDay,
      argMinDay,
      flat: summary.flat,
      firstActiveDay: first,
      lastActiveDay: last,
    });
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'max':
        primary = b.cusumMax - a.cusumMax;
        break;
      case 'min':
        primary = a.cusumMin - b.cusumMin; // most-negative first
        break;
      case 'range':
        primary = b.cusumRange - a.cusumRange;
        break;
      case 'normmax':
        primary = b.normMax - a.normMax;
        break;
      case 'normmin':
        primary = a.normMin - b.normMin;
        break;
      case 'normrange':
        primary = b.normRange - a.normRange;
        break;
      case 'driftindex':
        primary = b.driftIndex - a.driftIndex;
        break;
      case 'absdriftindex':
        primary = Math.abs(b.driftIndex) - Math.abs(a.driftIndex);
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
