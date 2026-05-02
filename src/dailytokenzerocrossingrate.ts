/**
 * daily-token-zero-crossing-rate: per-source ZERO-CROSSING
 * RATE of the demeaned gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-FIFTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Let mu = mean(x) and y[i] = x[i] - mu. Define the sign of
 * each demeaned sample as
 *
 *     s[i] = sign(y[i])  in {-1, 0, +1}
 *
 * with the convention sign(0) = 0 (a sample exactly at the
 * mean is neither positive nor negative -- it is treated as
 * a "no-sign" sample and never counted as a crossing on its
 * own; crossings are only declared between adjacent samples
 * whose signs are both non-zero AND opposite). The
 * zero-crossing count is
 *
 *     C = #{ i in [0, n-2] : s[i] != 0  AND  s[i+1] != 0
 *                            AND  s[i] != s[i+1] }
 *
 * The headline scalar is the ZERO-CROSSING RATE
 *
 *     zcr = C / (n - 1)
 *
 * the fraction of adjacent-pair transitions that are sign-
 * change events, in [0, 1]. Reported alongside `zcr`:
 * `nCrossings` (= C), `nZeroSamples` (count of samples with
 * y[i] == 0; these are the demeaned zeros that are dropped
 * from sign-comparison), `meanRunLength` (mean length of a
 * maximal run of consecutive same-sign non-zero samples; for
 * a strictly alternating series this approaches 1, for a
 * single-sign series it approaches the length of the
 * non-zero subsequence), and `zcrExpectedWhite = 0.5` (the
 * asymptotic ZCR for a zero-mean i.i.d. continuous-noise
 * source -- the standard reference anchor).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY NEW
 * PRIMITIVE NOT REDUCIBLE TO ANY OTHER 79-104 DAILY-TOKEN
 * AXIS:
 *
 *   - Class. ZCR is a TIME-DOMAIN SYMBOLIC statistic on the
 *     demeaned series x - mu. It is the FIRST axis in the
 *     daily-token chain that operates purely on the SIGN
 *     SEQUENCE of the demeaned signal (no magnitudes, no
 *     spectral transform, no inequality functional, no
 *     PSD). Class-TIME-DOMAIN-SYMBOLIC, distinct from:
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
 *         multiset of values; ZCR depends on temporal
 *         ORDER of the signs.
 *
 *       * the spectral / PSD axes (84-102): each maps the
 *         WHOLE-tenure PSD to a scalar via the
 *         periodogram operator (cosine/sine projections
 *         summed over the whole series). PSD is invariant
 *         to TIME-REVERSAL and the periodogram operator
 *         erases the SIGN of the time-domain samples
 *         entirely (the magnitude squared throws sign
 *         away). ZCR is built directly from the sign
 *         sequence and changes under time reversal of
 *         non-symmetric series.
 *
 *       * the dynamic-spectral axes (103, 104): both are
 *         FRAME-SLIDING statistics on the LOCAL PSD --
 *         either the L2 distance between consecutive
 *         unit-energy PSD vectors (axis-103) or the
 *         frame-to-frame change in a single shape scalar
 *         of the local PSD (axis-104). Both still discard
 *         the SIGN of the time-domain samples within each
 *         frame. ZCR is a single-pass tally over the full
 *         tenure that depends ONLY on the binary sign
 *         sequence.
 *
 *   - vs Hjorth-mobility (axis-79) and Hjorth-complexity
 *     (axis-80). Hjorth-mobility = sqrt(var(dx)/var(x)) is
 *     a CONTINUOUS variance-ratio of the first-difference
 *     series. ZCR is a DISCRETE event-count on the sign
 *     sequence. They are not comonotone:
 *
 *       (a) Two series with identical first-difference
 *           variance and identical signal variance can
 *           have very different ZCR. Counter-example:
 *           x = (+1, -1, +1, -1, ..., +1, -1) and
 *           x' = (+a, -a, -a, +a, +a, -a, -a, +a, ...) for
 *           appropriate a -- both have identical
 *           per-sample magnitudes |x[i]| = |x'[i]| and
 *           identical sample variance, but the
 *           strictly-alternating x has ZCR = 1 while x'
 *           (sign pattern +--++--+...) has ZCR = 1/2.
 *           Yet `var(dx)/var(x)` differs only in a
 *           bounded ratio, not factor 2. So the mapping
 *           Hjorth-mobility -> ZCR is many-to-one in one
 *           direction and one-to-many in the other.
 *
 *       (b) A monotone series with one large jump in the
 *           middle (e.g. x = (1,2,3,...,k, -k,...,-3,-2,
 *           -1)) has high Hjorth-mobility (one large
 *           first-difference dominates `var(dx)`), but
 *           its sign sequence is (+,...,+,-,...,-) so
 *           ZCR = 1/(n-1).
 *
 *   - vs Teager-Kaiser energy (axis-81). TKE involves
 *     both x[i]^2 and x[i-1]*x[i+1] so it is a SQUARED
 *     local-product statistic, not a sign-change count.
 *
 *   - vs curvature-sign-change-rate (axis-82). Axis-82
 *     counts sign changes of the SECOND difference
 *     d2x[i] = x[i+1] - 2*x[i] + x[i-1] (a CURVATURE
 *     reversal -- a change from "concave up" to "concave
 *     down" or vice versa). ZCR counts sign changes of
 *     the LEVEL itself relative to the mean. They are
 *     different signals: a strictly monotone increasing
 *     series with concave-up then concave-down shape can
 *     have axis-82 = 1/(n-2) (one curvature flip) while
 *     ZCR is dominated by however many times the level
 *     itself crosses the mean, which for a smooth
 *     concave-up/concave-down hump above the mean can be
 *     0/(n-1).
 *
 *   - vs LZ complexity (axis-83). LZ on the binary
 *     above-/below-mean sequence is a DICTIONARY-PARSING
 *     count of distinct subwords; ZCR is the simple
 *     adjacent-bit-flip count. A strictly alternating
 *     binary string (+-+-+-+-+-...) has ZCR = 1 but very
 *     LOW LZ complexity (the dictionary saturates at one
 *     repeated phrase). A single-sign string (++++++++)
 *     has ZCR = 0 and also LOW LZ complexity. The two
 *     statistics are not monotone in either direction.
 *
 *   - vs run-length axes (monotone-run-length, second-
 *     diff sign runs, runs-test Z). Those summarise the
 *     LENGTH DISTRIBUTION of monotonicity / sign runs of
 *     DIFFERENCES; ZCR is the SIMPLE COUNT of sign
 *     changes of LEVELS. The runs-test Z standardises a
 *     run count to a normal score under an
 *     i.i.d. null; ZCR is the raw normalised event rate
 *     and exposes the meanRunLength as a separate field.
 *
 *   - vs autocorrelation lag-1 / lag-7 axes. Those are
 *     normalised inner products of the WHOLE series with
 *     itself; the relationship `zcr ~= 1 - acos(rho_1)/pi`
 *     holds only for a stationary GAUSSIAN process
 *     (Kedem 1986), and the daily-token series is in
 *     general non-Gaussian, so the two are independent
 *     descriptors in practice.
 *
 *   - vs sample / permutation / approximate entropy. Those
 *     measure pattern-recurrence complexity on amplitude
 *     embeddings; ZCR is a single binary statistic on the
 *     sign sequence.
 *
 *   - vs Rice's formula and the spectral-centroid bridge.
 *     For a continuous, stationary Gaussian process,
 *     E[ZCR] = (1/pi) * sqrt(M2/M0) where M_k is the
 *     k-th spectral moment. The daily-token series is
 *     discrete, integer-valued, non-Gaussian and small
 *     (n ~ 16-72), so this bridge does not hold
 *     numerically -- we treat ZCR as an independent
 *     time-domain primitive.
 *
 * Headline question:
 * **"For each source, how often does the demeaned daily-
 *   token activity flip from above-mean to below-mean (or
 *   vice versa) from one day to the next, over its tenure?"**
 *
 * Caveats:
 *
 *   - zcr is in [0, 1]. zcr = 0 iff every adjacent pair of
 *     non-zero-demeaned samples has the same sign (a
 *     monotone or one-sided series). zcr = 1 iff every
 *     adjacent pair of non-zero-demeaned samples has
 *     opposite sign (strict alternation). For an
 *     i.i.d. zero-mean continuous noise source, the
 *     asymptotic ZCR is 1/2 (Kedem 1986).
 *   - Samples with y[i] == 0 (rare for non-trivial integer
 *     series, but possible when mu happens to equal an
 *     observed daily total exactly) are surfaced as
 *     `nZeroSamples` and are not counted as crossings on
 *     their own; they bridge the surrounding pair (we walk
 *     the non-zero subsequence).
 *   - Zero-variance series (every day has the same token
 *     mass, so y == 0 everywhere) are dropped as
 *     `droppedZeroVariance`; ZCR is undefined when no
 *     non-zero-demeaned sample exists.
 *   - meanRunLength is the mean length of a maximal run of
 *     consecutive same-sign NON-ZERO samples; for a
 *     strictly alternating series with no demeaned zeros
 *     it equals 1; for a series with a single sign-flip
 *     in the middle it equals roughly n/2.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-zero-crossing-rate
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-zero-crossing-rate \
 *     --source vscode-other --json
 *
 *   # Sort by mean run length descending (longest persistence
 *   # of above-/below-mean stretches first):
 *   pew-insights daily-token-zero-crossing-rate \
 *     --sort meanRunLengthDesc
 *
 * References:
 *   Kedem, B., "Spectral analysis and discrimination by
 *     zero-crossings", Proc. IEEE 74(11), 1986.
 *   Rice, S. O., "Mathematical analysis of random noise",
 *     Bell Sys. Tech. J. 23(3), 1944.
 *   Lerch, A., "An Introduction to Audio Content Analysis",
 *     Wiley-IEEE Press, 2012, sec. 3.2.4 (zero-crossing
 *     rate as a time-domain feature).
 */
import type { QueueLine } from './types.js';

export type DailyTokenZeroCrossingRateSort =
  | 'zcr'
  | 'zcrDesc'
  | 'meanRunLength'
  | 'meanRunLengthDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenZeroCrossingRateOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4 so at
   * least three adjacent pairs are available for a
   * meaningful sign-change rate.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenZeroCrossingRateSort;
  generatedAt?: string;
}

export interface DailyTokenZeroCrossingRateSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /**
   * Number of demeaned samples y[i] == 0 (skipped in the
   * sign-change comparison; the surrounding pair is
   * bridged by walking the non-zero subsequence).
   */
  nZeroSamples: number;
  /** Number of (non-zero) sign-change events C. */
  nCrossings: number;
  /**
   * Number of adjacent pairs (i, i+1) considered. Equals
   * (n - 1) where n = nTenureDays; used as the ZCR
   * denominator for backward compatibility with the
   * Lerch / Rice convention.
   */
  nPairs: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** zcr = nCrossings / (nTenureDays - 1) in [0, 1]. */
  zcr: number;
  /**
   * Mean length of a maximal run of consecutive same-sign
   * NON-ZERO demeaned samples. >= 1.
   */
  meanRunLength: number;
  /** Asymptotic ZCR for zero-mean i.i.d. continuous noise. */
  zcrExpectedWhite: number;
}

export interface DailyTokenZeroCrossingRateReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenZeroCrossingRateSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedAllZeroDemeaned: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenZeroCrossingRateSourceRow[];
}

/**
 * Zero-crossing-rate primitive on a real-valued series.
 *
 * Computes the demeaned series y = x - mean(x), then counts
 * sign-change events on the sign sequence. Demeaned zeros
 * are dropped from sign comparison (the surrounding pair is
 * bridged) and surfaced as nZeroSamples.
 *
 * Closed-form sanity anchors:
 *   - constant series -> mu = x, y = 0, every sample is a
 *     demeaned zero -> throws "all demeaned samples zero".
 *   - strictly monotone series with mean in the middle ->
 *     a single sign change near the centre -> nCrossings ~ 1.
 *   - strictly alternating about the mean -> nCrossings =
 *     n - 1 -> zcr = 1.
 *   - i.i.d. zero-mean continuous noise -> E[zcr] -> 0.5.
 *
 * Throws when the series is too short, non-finite, or
 * yields zero non-zero-demeaned samples.
 */
export function dailyTokenZeroCrossingRate(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  nZeroSamples: number;
  nCrossings: number;
  nPairs: number;
  zcr: number;
  meanRunLength: number;
  zcrExpectedWhite: number;
} {
  const n = values.length;
  if (n < 2) {
    throw new Error(
      `dailyTokenZeroCrossingRate: need at least 2 samples (got ${n})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenZeroCrossingRate requires finite values',
      );
    }
  }
  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  if (mn === mx) {
    throw new Error(
      'dailyTokenZeroCrossingRate: zero variance (constant series)',
    );
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

  // Build sign sequence; 0 means demeaned-zero (skipped).
  const signs = new Array<number>(n);
  let nZeroSamples = 0;
  for (let i = 0; i < n; i += 1) {
    const d = values[i]! - mu;
    if (d > 0) signs[i] = +1;
    else if (d < 0) signs[i] = -1;
    else {
      signs[i] = 0;
      nZeroSamples += 1;
    }
  }
  const nNonZero = n - nZeroSamples;
  if (nNonZero === 0) {
    throw new Error(
      'dailyTokenZeroCrossingRate: all demeaned samples zero (degenerate)',
    );
  }

  // Walk the non-zero subsequence to count sign changes and
  // run lengths. A "run" is a maximal block of consecutive
  // same-sign NON-ZERO entries (in the non-zero subsequence).
  let nCrossings = 0;
  let prev = 0;
  let runs = 0;
  let curRunLen = 0;
  let runLenSum = 0;
  for (let i = 0; i < n; i += 1) {
    const s = signs[i]!;
    if (s === 0) continue;
    if (prev === 0) {
      runs = 1;
      curRunLen = 1;
    } else if (s !== prev) {
      nCrossings += 1;
      runLenSum += curRunLen;
      runs += 1;
      curRunLen = 1;
    } else {
      curRunLen += 1;
    }
    prev = s;
  }
  // close out the final run
  if (runs > 0) runLenSum += curRunLen;

  const nPairs = n - 1;
  const zcr = nCrossings / nPairs;
  if (!Number.isFinite(zcr)) {
    throw new Error(
      `dailyTokenZeroCrossingRate: non-finite zcr (nCrossings=${nCrossings}, nPairs=${nPairs})`,
    );
  }
  const meanRunLength = runs > 0 ? runLenSum / runs : 0;
  return {
    mean: mu,
    stddev,
    nSamples: n,
    nZeroSamples,
    nCrossings,
    nPairs,
    zcr,
    meanRunLength,
    zcrExpectedWhite: 0.5,
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

export function buildDailyTokenZeroCrossingRate(
  queue: QueueLine[],
  opts: DailyTokenZeroCrossingRateOptions = {},
): DailyTokenZeroCrossingRateReport {
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
  const sort: DailyTokenZeroCrossingRateSort = opts.sort ?? 'zcrDesc';
  const validSorts: DailyTokenZeroCrossingRateSort[] = [
    'zcr',
    'zcrDesc',
    'meanRunLength',
    'meanRunLengthDesc',
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
  let droppedAllZeroDemeaned = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenZeroCrossingRateSourceRow[] = [];

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
      result = dailyTokenZeroCrossingRate(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('all demeaned samples zero')) {
        droppedAllZeroDemeaned += 1;
      } else {
        droppedNonFiniteFit += 1;
      }
      continue;
    }
    const row: DailyTokenZeroCrossingRateSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      nZeroSamples: result.nZeroSamples,
      nCrossings: result.nCrossings,
      nPairs: result.nPairs,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      zcr: result.zcr,
      meanRunLength: result.meanRunLength,
      zcrExpectedWhite: result.zcrExpectedWhite,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'zcr':
        primary = a.zcr - b.zcr;
        break;
      case 'zcrDesc':
        primary = b.zcr - a.zcr;
        break;
      case 'meanRunLength':
        primary = a.meanRunLength - b.meanRunLength;
        break;
      case 'meanRunLengthDesc':
        primary = b.meanRunLength - a.meanRunLength;
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
    droppedAllZeroDemeaned,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
