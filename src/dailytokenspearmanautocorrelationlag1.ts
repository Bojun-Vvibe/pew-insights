/**
 * daily-token-spearman-autocorrelation-lag1: per-source
 * SPEARMAN RANK SERIAL AUTOCORRELATION at LAG 1 of the
 * gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SEVENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Form the two lagged vectors
 *
 *     u = (x[0],   x[1],   ..., x[n-2])
 *     v = (x[1],   x[2],   ..., x[n-1])
 *
 * Replace each entry by its midrank (average rank under
 * ties) within its own vector, giving R(u) and R(v). The
 * SPEARMAN LAG-1 SERIAL AUTOCORRELATION is the Pearson
 * correlation of the rank vectors:
 *
 *     rs1 = corr(R(u), R(v))
 *         = cov(R(u), R(v)) / (sd(R(u)) * sd(R(v)))
 *
 * in [-1, +1]. We use midrank (the standard Hollander-
 * Wolfe convention) so that ties contribute fairly without
 * inflating the variance.
 *
 * The headline scalar is `rs1`. Reported alongside `rs1`:
 * `nPairs = n - 1`, `rs1ExpectedIid = 0` (asymptotic E[rs1]
 * under independence), and the standardised score
 *
 *     rs1Z = rs1 * sqrt(n - 2)
 *
 * approximately N(0, 1) for large n under the independence
 * null (Brockwell & Davis, "Time Series: Theory and
 * Methods", 2nd ed., Springer, 1991, sec. 7.2; Hollander &
 * Wolfe, "Nonparametric Statistical Methods", 3rd ed.,
 * Wiley, 2014, sec. 8.5).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN AXIS
 * IN 79-106:
 *
 *   - Class. RANK-AUTOCORRELATION is invariant to any
 *     STRICTLY MONOTONE TRANSFORMATION of the level series.
 *     If we replace x by f(x) for any strictly increasing
 *     f (log, sqrt, scaled exp, percentile rank, etc.),
 *     `rs1` is UNCHANGED. This makes it a copula statistic:
 *     it depends only on the joint COPULA of (x[t], x[t+1])
 *     and not on the marginal distribution of x.
 *
 *   - vs daily-token-autocorrelation-lag1 (axis pre-existing
 *     in the catalogue). Pearson lag-1 is the LINEAR serial
 *     correlation of the LEVEL series. It is sensitive to
 *     the marginal distribution and to outliers: one
 *     anomalous spike can drag rho1 substantially. The
 *     Spearman lag-1 we ship here applies the rank
 *     transform first, which is bounded in [1, n] and
 *     bounded-influence: a single spike contributes at most
 *     rank n - 1. Two series with identical rank ordering
 *     but very different marginal shape give the SAME rs1
 *     and DIFFERENT rho1; conversely, a heavy-tailed series
 *     and its log-transform give DIFFERENT rho1 and the
 *     SAME rs1. So rs1 and rho1 are independent functionals.
 *
 *   - vs daily-token-autocorrelation-lag7. That axis is at
 *     a different lag (weekly seasonality). rs1 is at lag 1.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson, Theil,
 *     Palma, Hoover, ...). All of those are PERMUTATION-
 *     INVARIANT functionals of the empirical distribution:
 *     they depend only on the multiset of values. Rank
 *     autocorrelation depends on the TEMPORAL ORDER of the
 *     ranks. Permuting the daily series leaves every
 *     inequality axis unchanged but changes rs1 in general.
 *
 *   - vs the symbolic time-domain axes (zero-crossing-rate
 *     axis-105, turning-point-rate axis-106, runs-test-z,
 *     monotone-run-length, second-difference sign runs).
 *     Each of those collapses the level (or its first/second
 *     difference) to a SIGN sequence and counts events on
 *     that binary sequence. rs1 retains the full RANK
 *     resolution (n distinct rank levels rather than 2 sign
 *     levels), so it carries strictly more information than
 *     any of those binary statistics on the same series.
 *     Concretely: a strictly monotone series has TPR = 0
 *     and ZCR ~ 1/(n-1) but rs1 = +1; a strict alternation
 *     has TPR = 1, ZCR = 1, and rs1 < 0 (around -0.5 for
 *     small n, -> -1 for strict 2-cycle).
 *
 *   - vs the spectral / PSD axes (axis-84 to axis-104).
 *     Each PSD axis maps the WHOLE-tenure (or frame-local)
 *     periodogram to a scalar. The periodogram is
 *     invariant to TIME-REVERSAL (PSD of x and PSD of
 *     reverse(x) are identical). rs1 is NOT invariant to
 *     time-reversal in general (though it is for purely
 *     symmetric-in-lag autoregressive structure). More
 *     importantly, the periodogram throws away the SIGN
 *     of phase information; rs1 is built directly from
 *     rank-paired comparisons.
 *
 *   - vs the entropy axes (sample entropy, permutation
 *     entropy, approximate entropy, Renyi spectral entropies,
 *     spectral entropy itself). Those are pattern-recurrence
 *     complexity measures on amplitude / spectral
 *     embeddings; rs1 is a single bilinear statistic on
 *     paired ranks.
 *
 *   - vs the fractal-dimension axes (Higuchi, Katz,
 *     Petrosian, Sevcik, box-count, DFA alpha, Hurst R/S).
 *     Those measure scaling exponents (long-range structure).
 *     rs1 is a single-lag local statistic and changes
 *     immediately under a one-day shuffle, while a fractal
 *     dimension is a global asymptotic.
 *
 *   - vs Hjorth-mobility (axis-79) and Hjorth-complexity
 *     (axis-80). Hjorth-mobility = sqrt(var(dx)/var(x)) is
 *     a CONTINUOUS variance-ratio of the first-difference
 *     series and is sensitive to magnitude. rs1 is a rank
 *     correlation and is magnitude-blind.
 *
 *   - vs Teager-Kaiser energy (axis-81). TKE involves
 *     x[i]^2 and x[i-1]*x[i+1] -- a CONTINUOUS-magnitude
 *     local-product statistic, not a rank-pair correlation.
 *
 * Headline question:
 * **"For each source, how strongly does today's RANK in its
 *   own daily-token distribution predict tomorrow's RANK,
 *   stripping out the marginal distribution shape?"**
 *
 * Reference:
 *   Spearman, C., "The proof and measurement of association
 *     between two things", American Journal of Psychology
 *     15, 1904, pp. 72-101.
 *   Hollander, M. and Wolfe, D. A., "Nonparametric
 *     Statistical Methods" (3rd ed., Wiley, 2014), sec. 8.5
 *     "Kendall and Spearman serial coefficients".
 *   Brockwell, P. J. and Davis, R. A., "Time Series:
 *     Theory and Methods" (2nd ed., Springer, 1991),
 *     sec. 7.2 (asymptotic null variance ~ 1/(n-1)).
 *
 * Caveats:
 *
 *   - rs1 is in [-1, +1]. rs1 = +1 iff the rank order of
 *     u and v matches exactly (perfect monotone serial
 *     dependence at lag 1). rs1 = -1 iff the rank order is
 *     exactly reversed.
 *   - Midrank (average-rank under ties) is the
 *     Hollander-Wolfe convention; it preserves
 *     E[rank] = (n+1)/2 for both u and v even with ties,
 *     so cov(R(u), R(v)) is well-defined.
 *   - Zero-variance rank vectors (all values equal) are
 *     dropped as `droppedZeroVariance`; rs1 is undefined
 *     when either rank vector is constant (the Pearson
 *     denominator vanishes).
 *   - rs1Z = rs1 * sqrt(n - 2) is the large-n approximation;
 *     daily-token series are integer-valued and small
 *     (n ~ 16-72) so |rs1Z| > 2 should be read as
 *     "less independent than iid" rather than as a
 *     calibrated p-value.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-spearman-autocorrelation-lag1
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-spearman-autocorrelation-lag1 \
 *     --source vscode-other --json
 *
 *   # Sort by absolute z-score descending (most non-iid
 *   # first):
 *   pew-insights daily-token-spearman-autocorrelation-lag1 \
 *     --sort rs1ZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenSpearmanAutocorrelationLag1Sort =
  | 'rs1'
  | 'rs1Desc'
  | 'rs1Z'
  | 'rs1ZDesc'
  | 'rs1ZAbs'
  | 'rs1ZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpearmanAutocorrelationLag1Options {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4 so at
   * least three rank pairs are available for a meaningful
   * Spearman correlation.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpearmanAutocorrelationLag1Sort;
  generatedAt?: string;
}

export interface DailyTokenSpearmanAutocorrelationLag1SourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /** Number of (x[t], x[t+1]) lag-1 pairs. Equals n - 1. */
  nPairs: number;
  /**
   * Number of tied entries in the lagged vector u =
   * (x[0..n-2]) -- counted as the sum over tied groups of
   * (group size choose 2). Surfaces tie pressure on the
   * Spearman estimate.
   */
  nTiesU: number;
  /** Same for v = (x[1..n-1]). */
  nTiesV: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** Spearman rank serial autocorrelation at lag 1, in [-1, 1]. */
  rs1: number;
  /** Standardised score rs1 * sqrt(n - 2). */
  rs1Z: number;
  /** Asymptotic E[rs1] under independence. */
  rs1ExpectedIid: number;
}

export interface DailyTokenSpearmanAutocorrelationLag1Report {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpearmanAutocorrelationLag1Sort;
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
  sources: DailyTokenSpearmanAutocorrelationLag1SourceRow[];
}

/**
 * Compute midranks (average-rank under ties) of a numeric
 * vector. Returns a vector of the same length whose entry
 * i is the average of the 1-based rank positions of all
 * entries equal to values[i] when the vector is sorted
 * ascending.
 *
 * E.g. midranks([10, 20, 20, 30]) -> [1, 2.5, 2.5, 4].
 *
 * Also returns `nTies`, the sum over tied groups of
 * binomial(groupSize, 2), as a tie-pressure summary.
 */
export function midranks(values: number[]): {
  ranks: number[];
  nTies: number;
} {
  const n = values.length;
  const idx = new Array<number>(n);
  for (let i = 0; i < n; i += 1) idx[i] = i;
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks = new Array<number>(n);
  let nTies = 0;
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && values[idx[j]!]! === values[idx[i]!]!) j += 1;
    // group is idx[i..j-1], 1-based ranks i+1..j
    const groupSize = j - i;
    const avgRank = (i + 1 + j) / 2; // mean of i+1, i+2, ..., j
    for (let k = i; k < j; k += 1) ranks[idx[k]!] = avgRank;
    if (groupSize >= 2) nTies += (groupSize * (groupSize - 1)) / 2;
    i = j;
  }
  return { ranks, nTies };
}

/**
 * Spearman lag-1 serial autocorrelation primitive on a
 * real-valued series.
 *
 * Forms u = x[0..n-2] and v = x[1..n-1], midranks both,
 * and returns the Pearson correlation of the rank vectors.
 *
 * Closed-form sanity anchors:
 *   - strictly monotone increasing series x = (1, 2, 3, ...)
 *     -> u-ranks (1, 2, ..., n-1), v-ranks (1, 2, ..., n-1)
 *     -> rs1 = +1.
 *   - strictly monotone decreasing -> rs1 = +1 (both u and v
 *     are reversed but in lockstep).
 *   - strict 2-cycle (1, 2, 1, 2, ..., 1) of length n
 *     -> rs1 -> -1 as n -> infinity (negative serial
 *     dependence).
 *   - i.i.d. continuous sample -> E[rs1] = 0.
 *
 * Throws when the series is too short or non-finite.
 */
export function dailyTokenSpearmanAutocorrelationLag1(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  nPairs: number;
  nTiesU: number;
  nTiesV: number;
  rs1: number;
  rs1Z: number;
  rs1ExpectedIid: number;
} {
  const n = values.length;
  if (n < 3) {
    throw new Error(
      `dailyTokenSpearmanAutocorrelationLag1: need at least 3 samples (got ${n})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpearmanAutocorrelationLag1 requires finite values',
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

  const m = n - 1;
  const u = new Array<number>(m);
  const v = new Array<number>(m);
  for (let i = 0; i < m; i += 1) {
    u[i] = values[i]!;
    v[i] = values[i + 1]!;
  }
  const ru = midranks(u);
  const rv = midranks(v);
  // Pearson correlation of midranks.
  let muU = 0;
  let muV = 0;
  for (let i = 0; i < m; i += 1) {
    muU += ru.ranks[i]!;
    muV += rv.ranks[i]!;
  }
  muU /= m;
  muV /= m;
  let cov = 0;
  let varU = 0;
  let varV = 0;
  for (let i = 0; i < m; i += 1) {
    const du = ru.ranks[i]! - muU;
    const dv = rv.ranks[i]! - muV;
    cov += du * dv;
    varU += du * du;
    varV += dv * dv;
  }
  if (varU <= 0 || varV <= 0) {
    throw new Error(
      `dailyTokenSpearmanAutocorrelationLag1: zero-variance rank vector (varU=${varU}, varV=${varV})`,
    );
  }
  const rs1 = cov / Math.sqrt(varU * varV);
  if (!Number.isFinite(rs1)) {
    throw new Error(
      `dailyTokenSpearmanAutocorrelationLag1: non-finite rs1 (cov=${cov}, varU=${varU}, varV=${varV})`,
    );
  }
  // Brockwell & Davis 1991 sec. 7.2: under the iid null,
  // sqrt(n-1) * rs1 -> N(0, 1) asymptotically; we use the
  // small-sample correction sqrt(n-2) (matches the standard
  // t-statistic form rs1 * sqrt((n-2)/(1-rs1^2)) clamped to
  // the linear lead term, which is the standard
  // distribution-free reporting form for short series).
  const rs1Z = n > 2 ? rs1 * Math.sqrt(n - 2) : 0;
  return {
    mean: mu,
    stddev,
    nSamples: n,
    nPairs: m,
    nTiesU: ru.nTies,
    nTiesV: rv.nTies,
    rs1,
    rs1Z,
    rs1ExpectedIid: 0,
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

export function buildDailyTokenSpearmanAutocorrelationLag1(
  queue: QueueLine[],
  opts: DailyTokenSpearmanAutocorrelationLag1Options = {},
): DailyTokenSpearmanAutocorrelationLag1Report {
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
  const sort: DailyTokenSpearmanAutocorrelationLag1Sort =
    opts.sort ?? 'rs1ZAbsDesc';
  const validSorts: DailyTokenSpearmanAutocorrelationLag1Sort[] = [
    'rs1',
    'rs1Desc',
    'rs1Z',
    'rs1ZDesc',
    'rs1ZAbs',
    'rs1ZAbsDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
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
  const rows: DailyTokenSpearmanAutocorrelationLag1SourceRow[] = [];

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
      result = dailyTokenSpearmanAutocorrelationLag1(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenSpearmanAutocorrelationLag1SourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      nPairs: result.nPairs,
      nTiesU: result.nTiesU,
      nTiesV: result.nTiesV,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      rs1: result.rs1,
      rs1Z: result.rs1Z,
      rs1ExpectedIid: result.rs1ExpectedIid,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'rs1':
        primary = a.rs1 - b.rs1;
        break;
      case 'rs1Desc':
        primary = b.rs1 - a.rs1;
        break;
      case 'rs1Z':
        primary = a.rs1Z - b.rs1Z;
        break;
      case 'rs1ZDesc':
        primary = b.rs1Z - a.rs1Z;
        break;
      case 'rs1ZAbs':
        primary = Math.abs(a.rs1Z) - Math.abs(b.rs1Z);
        break;
      case 'rs1ZAbsDesc':
        primary = Math.abs(b.rs1Z) - Math.abs(a.rs1Z);
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
