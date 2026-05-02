/**
 * daily-token-turning-point-rate: per-source TURNING-POINT
 * RATE of the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SIXTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * An interior index i in [1, n-2] is a TURNING POINT when
 * x[i] is a strict local extremum, i.e.
 *
 *     (x[i-1] < x[i] AND x[i] > x[i+1])   [strict peak]
 *  OR (x[i-1] > x[i] AND x[i] < x[i+1])   [strict trough]
 *
 * Plateaux (x[i-1] == x[i] OR x[i] == x[i+1]) are NOT
 * counted as turning points; they are surfaced separately
 * as `nPlateauTriples`. Equivalently, T is the count of
 * sign changes in the FIRST DIFFERENCE sequence
 * d[i] = x[i+1] - x[i], restricted to non-zero adjacent
 * pairs.
 *
 * The headline scalar is the TURNING-POINT RATE
 *
 *     tpr = T / (n - 2)   in   [0, 1]
 *
 * the fraction of interior triples that are strict local
 * extrema. Reported alongside `tpr`:
 * `nTurningPoints = T`, `nPlateauTriples` (interior
 * triples touching a plateau and therefore disqualified),
 * `nInteriorTriples = n - 2`, `tprExpectedIid = 2/3` --
 * the asymptotic expected value of T/(n-2) for an
 * i.i.d. continuous sample (Kendall, "Time Series", 3rd
 * ed., 1973, sec. 2.7; the "turning point test" or
 * Bienayme-Kendall statistic). The variance of the count T
 * under the iid null is `(16n - 29) / 90`, so the
 * standardised z-score is also exposed as `tprZ`.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER 79-105 DAILY-
 * TOKEN AXIS:
 *
 *   - Class. TURNING-POINT-RATE is a TIME-DOMAIN SYMBOLIC
 *     statistic on the FIRST DIFFERENCE series. It counts
 *     local extrema of the LEVEL series, equivalently sign
 *     changes of the FIRST DIFFERENCE. The previously
 *     shipped axis-105 (zero-crossing-rate) counts sign
 *     changes of the LEVEL itself relative to the mean.
 *     The two are provably independent:
 *
 *       * ZCR is a sign-change count of `x - mean(x)`.
 *       * TPR is a sign-change count of `diff(x)`.
 *
 *     A monotone strictly-increasing series with mean in
 *     the middle has ZCR = 1/(n-1) (one mean crossing) but
 *     TPR = 0 (no local extrema). Conversely, a series
 *     that is strictly-alternating around its mean
 *     (+a, -a, +a, -a, ...) has ZCR = 1 AND TPR = 1, while
 *     a series like (1, 3, 2, 4, 3, 5, 4, ...) has TPR ~ 1
 *     but ZCR much smaller (rarely crosses its rising
 *     mean). So tpr and zcr are independent.
 *
 *   - Class-TIME-DOMAIN-SYMBOLIC, distinct from:
 *
 *       * the inequality / shape axes (Gini, Atkinson,
 *         Theil, Palma, Hoover, Bonferroni, Mehran,
 *         Pietra, Foster-Wolfson, Esteban-Ray, Wolfson,
 *         Zenga, Chakravarty, Kolm-Pollak, GE2, GE3, GE4,
 *         GEhalf, GEnegone, S-Gini, Amato, FGT, Hill-tail,
 *         decile / quintile / percentile gap ratios,
 *         IQR/median, MAD/median, log-MAD, midspread,
 *         var-of-logs, z-score-extremes, L-skewness,
 *         medcouple, Bowley): every one of those is a
 *         PERMUTATION-INVARIANT functional of the
 *         empirical distribution. They depend ONLY on the
 *         multiset of values; TPR depends on the TEMPORAL
 *         ORDER of differences.
 *
 *       * the spectral / PSD axes (84-104): each maps the
 *         WHOLE-tenure PSD (or a frame-sliding local PSD)
 *         to a scalar via squared-magnitude projections.
 *         PSD is invariant to TIME-REVERSAL and the
 *         periodogram operator erases the SIGN of
 *         differences entirely (squared magnitudes throw
 *         sign away). TPR is built directly from the sign
 *         sequence of the first difference.
 *
 *   - vs zero-crossing-rate (axis-105). See above:
 *     sign-change of LEVEL vs sign-change of FIRST
 *     DIFFERENCE. Provably orthogonal: monotone series
 *     give ZCR > 0 and TPR = 0; alternating series give
 *     both = 1; the two-axis space is genuinely 2D.
 *
 *   - vs Hjorth-mobility (axis-79) and Hjorth-complexity
 *     (axis-80). Hjorth-mobility = sqrt(var(dx)/var(x)) is
 *     a CONTINUOUS variance-ratio of the first-difference
 *     series. TPR is a DISCRETE event-count on the sign
 *     sequence of dx. Two series with identical
 *     `var(dx)/var(x)` can have TPR ranging from 0
 *     (monotone with one big outlier) to ~ 2/3 (irregular
 *     chatter): TPR ignores magnitudes, mobility ignores
 *     order.
 *
 *   - vs Teager-Kaiser energy (axis-81). TKE involves
 *     x[i]^2 and x[i-1]*x[i+1] -- a CONTINUOUS-magnitude
 *     local-product statistic, not a sign-change count.
 *
 *   - vs curvature-sign-change-rate (axis-82). Axis-82
 *     counts sign changes of the SECOND difference
 *     d2x[i] = x[i+1] - 2*x[i] + x[i-1]. TPR counts sign
 *     changes of the FIRST difference. They are not the
 *     same: a strictly-monotone-but-curving series like
 *     x[i] = i^2 has axis-82 = 0 (constant curvature) AND
 *     TPR = 0, while x = (1, 2, 1, 2, 1, ...) has both
 *     near 1; but the chirp x[i] = i + sin(i) has TPR > 0
 *     and axis-82 > 0 in distinct proportions. The
 *     mapping is many-to-many.
 *
 *   - vs LZ complexity (axis-83). LZ on the binary
 *     above-/below-mean sequence is a DICTIONARY-PARSING
 *     count of distinct subwords; TPR is a simple
 *     adjacent-triple extremum count on the LEVEL.
 *
 *   - vs run-length axes (monotone-run-length, second-
 *     diff sign runs, runs-test Z). Monotone-run-length
 *     summarises the LENGTH DISTRIBUTION of monotonic
 *     stretches; TPR is the COUNT of stretch boundaries
 *     normalised by interior length. Mathematically
 *     T = (number of monotone runs) - 1 in the
 *     plateau-free case, but the two axes report
 *     different functionals of that count: monotone-run-
 *     length reports the MEAN length, TPR reports the
 *     RATE.
 *
 *   - vs autocorrelation lag-1 / lag-7 axes. Those are
 *     normalised inner products of the WHOLE series with
 *     a shifted copy; TPR is a triple-local statistic.
 *
 *   - vs sample / permutation / approximate entropy. Those
 *     measure pattern-recurrence complexity on amplitude
 *     embeddings; TPR is a single binary statistic on the
 *     first-difference sign sequence.
 *
 * Headline question:
 * **"For each source, how often does the daily-token
 *   activity reverse direction (peak or trough) from one
 *   day to the next, over its tenure?"**
 *
 * Reference: Kendall, M. G., "Time Series" (3rd ed.,
 * Griffin & Co., London, 1973), sec. 2.7 "Tests of
 * randomness: turning points". Bienayme (1874) gave the
 * earliest version of the count. For an i.i.d. continuous
 * sample of length n,
 *
 *     E[T] = 2 (n - 2) / 3
 *     Var[T] = (16 n - 29) / 90
 *
 * so the standardised score
 *
 *     tprZ = (T - E[T]) / sqrt(Var[T])
 *
 * is approximately N(0, 1) under the iid null.
 *
 * Caveats:
 *
 *   - tpr is in [0, 1]. tpr = 0 iff the series is monotone
 *     non-decreasing or monotone non-increasing (no strict
 *     interior extremum). tpr = 1 iff every interior
 *     index is a strict extremum (Nyquist alternation,
 *     no plateaux).
 *   - Plateau triples (any of x[i-1] == x[i] OR
 *     x[i] == x[i+1]) are NOT counted toward T and are
 *     surfaced as `nPlateauTriples`. The denominator is
 *     ALWAYS n - 2 (the count of interior triples) so tpr
 *     is comparable across sources with different plateau
 *     densities.
 *   - Zero-variance series are dropped as
 *     `droppedZeroVariance`; TPR is undefined for a
 *     constant series (every interior triple is a plateau,
 *     T = 0, tpr = 0, but there is no signal to interpret).
 *   - tprZ uses the iid continuous-sample variance
 *     (Kendall 1973). The daily-token series is integer-
 *     valued and small (n ~ 16-72) so |tprZ| > 2 should
 *     be read as "less random than iid" rather than as a
 *     calibrated p-value.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-turning-point-rate
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-turning-point-rate \
 *     --source vscode-other --json
 *
 *   # Sort by absolute z-score descending (most non-random
 *   # first):
 *   pew-insights daily-token-turning-point-rate \
 *     --sort tprZAbsDesc
 *
 * References:
 *   Kendall, M. G., "Time Series" (3rd ed., Griffin & Co.,
 *     London, 1973), sec. 2.7.
 *   Bienayme, I.-J., "Sur une question de probabilites",
 *     Bull. Soc. Math. France 2, 1874, pp. 153-154.
 *   Brockwell, P. J. and Davis, R. A., "Introduction to
 *     Time Series and Forecasting" (3rd ed., Springer,
 *     2016), sec. 1.6 (turning-point test).
 */
import type { QueueLine } from './types.js';

export type DailyTokenTurningPointRateSort =
  | 'tpr'
  | 'tprDesc'
  | 'tprZ'
  | 'tprZDesc'
  | 'tprZAbs'
  | 'tprZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenTurningPointRateOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4 so at
   * least two interior triples are available for a
   * meaningful turning-point rate.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenTurningPointRateSort;
  generatedAt?: string;
}

export interface DailyTokenTurningPointRateSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /**
   * Number of interior triples (i in [1, n-2]) that touch
   * a plateau (x[i-1] == x[i] OR x[i] == x[i+1]) and are
   * therefore disqualified from being a strict extremum.
   */
  nPlateauTriples: number;
  /** Number of strict local extrema T. */
  nTurningPoints: number;
  /** Number of interior triples considered. Equals n - 2. */
  nInteriorTriples: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** tpr = nTurningPoints / (nTenureDays - 2) in [0, 1]. */
  tpr: number;
  /**
   * Standardised score (T - E[T]) / sqrt(Var[T]) under the
   * iid continuous null (Kendall 1973).
   */
  tprZ: number;
  /** Asymptotic E[T]/(n-2) for an iid continuous sample. */
  tprExpectedIid: number;
}

export interface DailyTokenTurningPointRateReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenTurningPointRateSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenTurningPointRateSourceRow[];
}

/**
 * Turning-point-rate primitive on a real-valued series.
 *
 * Counts strict interior local extrema (peaks AND troughs)
 * over indices i in [1, n-2]. Plateau triples (any
 * adjacent equality) are disqualified from being a strict
 * extremum and surfaced as nPlateauTriples. Returns the
 * count T, the rate T/(n-2), and the iid-null z-score
 * (T - E[T]) / sqrt(Var[T]) with E[T] = 2(n-2)/3 and
 * Var[T] = (16n - 29)/90 (Kendall 1973).
 *
 * Closed-form sanity anchors:
 *   - constant series -> every triple is a plateau -> T = 0,
 *     tpr = 0, nPlateauTriples = n - 2.
 *   - strictly monotone series -> no strict extremum
 *     anywhere -> T = 0, tpr = 0, nPlateauTriples = 0.
 *   - strict alternation x = (1, 2, 1, 2, ..., 1) ->
 *     every interior i is an extremum -> T = n - 2,
 *     tpr = 1.
 *   - i.i.d. continuous sample -> E[tpr] -> 2/3.
 *
 * Throws when the series is too short or non-finite.
 */
export function dailyTokenTurningPointRate(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  nPlateauTriples: number;
  nTurningPoints: number;
  nInteriorTriples: number;
  tpr: number;
  tprZ: number;
  tprExpectedIid: number;
} {
  const n = values.length;
  if (n < 3) {
    throw new Error(
      `dailyTokenTurningPointRate: need at least 3 samples (got ${n})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenTurningPointRate requires finite values',
      );
    }
  }

  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  let varSum = 0;
  for (const v of values) {
    const d = v - mu;
    varSum += d * d;
  }
  const stddev = Math.sqrt(varSum / n);

  let nTurningPoints = 0;
  let nPlateauTriples = 0;
  for (let i = 1; i < n - 1; i += 1) {
    const a = values[i - 1]!;
    const b = values[i]!;
    const c = values[i + 1]!;
    if (a === b || b === c) {
      nPlateauTriples += 1;
      continue;
    }
    const peak = a < b && b > c;
    const trough = a > b && b < c;
    if (peak || trough) {
      nTurningPoints += 1;
    }
  }
  const nInteriorTriples = n - 2;
  const tpr = nTurningPoints / nInteriorTriples;
  if (!Number.isFinite(tpr)) {
    throw new Error(
      `dailyTokenTurningPointRate: non-finite tpr (T=${nTurningPoints}, denom=${nInteriorTriples})`,
    );
  }
  // Kendall 1973: E[T] = 2(n-2)/3, Var[T] = (16n - 29)/90
  const expT = (2 * (n - 2)) / 3;
  const varT = (16 * n - 29) / 90;
  const tprZ = varT > 0 ? (nTurningPoints - expT) / Math.sqrt(varT) : 0;
  const tprExpectedIid = 2 / 3;
  return {
    mean: mu,
    stddev,
    nSamples: n,
    nPlateauTriples,
    nTurningPoints,
    nInteriorTriples,
    tpr,
    tprZ,
    tprExpectedIid,
  };
}

function addUtcDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

function dayDiffInclusive(a: string, b: string): number {
  const am = Date.parse(`${a}T00:00:00.000Z`);
  const bm = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((bm - am) / 86_400_000) + 1;
}

export function buildDailyTokenTurningPointRate(
  queue: QueueLine[],
  opts: DailyTokenTurningPointRateOptions = {},
): DailyTokenTurningPointRateReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 4) {
    throw new Error(
      `minTenureDays must be an integer >= 4 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenTurningPointRateSort = opts.sort ?? 'tprZAbsDesc';
  const validSorts: DailyTokenTurningPointRateSort[] = [
    'tpr',
    'tprDesc',
    'tprZ',
    'tprZDesc',
    'tprZAbs',
    'tprZAbsDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const sourceFilter = opts.source ?? null;

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
    perDay: Map<string, number>;
    totalTokens: number;
    firstDay: string;
    lastDay: string;
  }
  const agg = new Map<string, SrcAcc>();
  let droppedInvalidHourStart = 0;
  let droppedNonPositiveTokens = 0;
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
      droppedNonPositiveTokens += 1;
      continue;
    }
    const src =
      typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }
    const day = q.hour_start.slice(0, 10);
    let acc = agg.get(src);
    if (!acc) {
      acc = {
        perDay: new Map<string, number>(),
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, acc);
    }
    acc.perDay.set(day, (acc.perDay.get(day) ?? 0) + tt);
    acc.totalTokens += tt;
    if (day < acc.firstDay) acc.firstDay = day;
    if (day > acc.lastDay) acc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let droppedBelowMinTenure = 0;
  let droppedZeroVariance = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenTurningPointRateSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nTenure = dayDiffInclusive(acc.firstDay, acc.lastDay);
    if (nTenure < minTenureDays) {
      droppedBelowMinTenure += 1;
      continue;
    }
    const filled: number[] = new Array(nTenure);
    let cursor = acc.firstDay;
    for (let i = 0; i < nTenure; i += 1) {
      filled[i] = acc.perDay.get(cursor) ?? 0;
      cursor = addUtcDays(cursor, 1);
    }
    let mn = filled[0]!;
    let mx = filled[0]!;
    for (let i = 1; i < nTenure; i += 1) {
      const v = filled[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    let result;
    try {
      result = dailyTokenTurningPointRate(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenTurningPointRateSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      nPlateauTriples: result.nPlateauTriples,
      nTurningPoints: result.nTurningPoints,
      nInteriorTriples: result.nInteriorTriples,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      tpr: result.tpr,
      tprZ: result.tprZ,
      tprExpectedIid: result.tprExpectedIid,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tpr':
        primary = a.tpr - b.tpr;
        break;
      case 'tprDesc':
        primary = b.tpr - a.tpr;
        break;
      case 'tprZ':
        primary = a.tprZ - b.tprZ;
        break;
      case 'tprZDesc':
        primary = b.tprZ - a.tprZ;
        break;
      case 'tprZAbs':
        primary = Math.abs(a.tprZ) - Math.abs(b.tprZ);
        break;
      case 'tprZAbsDesc':
        primary = Math.abs(b.tprZ) - Math.abs(a.tprZ);
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'tenure':
        primary = b.nTenureDays - a.nTenureDays;
        break;
      case 'source':
      default:
        primary = 0;
        break;
    }
    if (Number.isNaN(primary) || primary === 0) {
      return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    return primary;
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
    minTokens,
    minTenureDays,
    top,
    sort,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinTenure,
    droppedZeroVariance,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
