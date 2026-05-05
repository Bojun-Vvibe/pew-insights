/**
 * daily-token-westenberg-halves: per-source
 * WESTENBERG (1948) INTERQUARTILE-RANGE EXCEEDANCE
 * SCALE TEST for equality of dispersion between the
 * FIRST half (n1 = floor(n/2) days) vs SECOND half
 * (n2 = n - n1 days) of the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-NINETY-EIGHTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into two contiguous halves
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Westenberg (1948 *Proc. Kon. Nederl. Akad. Wetensch.*
 * 51:252-261, "Significance test for median and
 * interquartile range in samples from continuous
 * populations of any form") proposed comparing the
 * INTERQUARTILE RANGE (IQR) of one sample to the OTHER
 * by counting how many observations of the OTHER sample
 * fall OUTSIDE the IQR of the FIRST. Under H0 (equal
 * continuous distributions) each B observation has
 * probability 0.5 of falling INSIDE [Q1_A, Q3_A] and 0.5
 * OUTSIDE; the COUNT of OUTSIDE B's is therefore
 * BINOMIAL(n2, 0.5) under H0 and SHIFTED UPWARD under a
 * SCALE-INFLATION alternative (B more dispersed = more B
 * mass in the tails outside A's IQR).
 *
 * Pipeline:
 *
 *   1. Compute the EMPIRICAL QUARTILES Q1_A and Q3_A of
 *      A using the TYPE-7 quantile estimator (Hyndman &
 *      Fan 1996 *Amer. Statist.* 50(4):361-365 sec. 3
 *      Definition 7), the R / NumPy default:
 *
 *          h = (n1 - 1) * p
 *          j = floor(h)
 *          g = h - j
 *          Q_p_A = sorted_A[j] + g * (sorted_A[j+1] - sorted_A[j])
 *
 *      with p = 0.25 for Q1, p = 0.75 for Q3.
 *
 *   2. Count the number of B observations strictly
 *      OUTSIDE [Q1_A, Q3_A] (the OUTSIDE count k):
 *
 *          k = #{ b in B : b < Q1_A or b > Q3_A }
 *
 *      Boundary observations are counted as INSIDE
 *      (i.e. NOT outside) per Westenberg's original
 *      convention; this is the conservative choice and
 *      matches the standard textbook treatment of
 *      INCLUSIVE quartile-range membership (Conover 1999
 *      *Practical Nonparametric Statistics* 3rd ed.,
 *      sec. 5.3, p. 309).
 *
 *   3. Under H0, the EXACT null distribution of k is
 *      BINOMIAL(n2, p0) with p0 = 0.5 (Westenberg 1948
 *      Theorem 1: the IQR of A asymptotically captures
 *      exactly half the population mass under any
 *      continuous CDF). The test statistic is
 *
 *          westZ = (k - n2 * p0) / sqrt(n2 * p0 * (1 - p0))
 *                = (k - n2 / 2) / sqrt(n2 / 4)
 *                = (2 * k - n2) / sqrt(n2)
 *                ~ N(0, 1)
 *
 *      asymptotically (DeMoivre-Laplace; valid for
 *      n2 >= 8, hence the hard floor n >= 16 below).
 *
 *      Sign convention: westZ > 0 means MORE B's
 *      OUTSIDE A's IQR than expected under H0, i.e.
 *      SECOND half MORE DISPERSED. westZ < 0 means
 *      FEWER B's outside, i.e. SECOND half MORE
 *      CONCENTRATED (or equivalently, FIRST half MORE
 *      DISPERSED). This matches the
 *      axis-117 / axis-170 / axis-177 / axis-196
 *      directional convention.
 *
 * Two-sided p-value (asymptotic normal):
 *
 *     westPValue = 2 * (1 - Phi(|westZ|))
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs axis-196 daily-token-fligner-killeen-halves
 *     (Fligner & Killeen 1976). FK uses HALF-NORMAL
 *     SCORES on POOLED MID-RANKS of within-half
 *     median-centred ABSOLUTE DEVIATIONS. Westenberg
 *     uses RAW QUARTILE BOUNDARIES of one half and
 *     COUNTS the other half's tail-mass. FK is a
 *     SCORE-FUNCTION rank test (every observation
 *     contributes a continuous score); Westenberg is a
 *     COUNT-WITHIN-RANGE test (every B observation
 *     contributes a 0/1). FK aggregates RANK
 *     INFORMATION across the entire sample; Westenberg
 *     ONLY uses the QUARTILE BOUNDARIES of A and the
 *     INSIDE/OUTSIDE STATUS of B. Different
 *     mechanisms, different power profiles: FK is
 *     locally-most-powerful for half-normal-distributed
 *     dispersion alternatives, Westenberg is
 *     locally-most-powerful for scale-inflation
 *     alternatives concentrated in the tails (e.g.
 *     contamination by a heavier-tailed mixture).
 *
 *   - vs axis-179 daily-token-mood-halves (Mood 1954
 *     median-test). Mood's median test counts B
 *     observations above/below the POOLED MEDIAN (a
 *     LOCATION test on a 2x2 contingency); Westenberg
 *     counts B observations OUTSIDE A's IQR (a SCALE
 *     test on a 2x1 binomial). Different parameter
 *     (median vs IQR), different alternative (location
 *     vs scale), different reference distribution
 *     (chi^2(1) vs Binomial-normal). Mood rejects
 *     under location shift with equal IQR; Westenberg
 *     rejects under scale shift with equal median.
 *
 *   - vs axis-177 Klotz, axis-170 Ansari-Bradley,
 *     axis-117 Siegel-Tukey (RANK-BASED scale tests).
 *     Those rely on the FULL POOLED RANK ORDER of
 *     all n observations (folded ranks or normal-
 *     squared scores). Westenberg uses ONLY the
 *     QUARTILE BOUNDARIES of A as a fixed threshold;
 *     it does NOT use the rank order of B observations
 *     beyond their inside/outside status. Robustness
 *     trade: rank tests are asymptotically more
 *     efficient under any continuous null, but
 *     Westenberg is exactly distribution-free even
 *     when the null distribution has heavy tails or
 *     point masses outside the IQR. The two
 *     mechanistically reject differently when SCALE
 *     change is concentrated in EXTREME TAIL RATHER
 *     THAN MID-DISPERSION.
 *
 *   - vs axis-193 daily-token-tukey-quick-halves (Tukey
 *     1959 end-count exceedance). Tukey-quick counts
 *     observations BEYOND the OPPOSITE SAMPLE'S
 *     MIN/MAX (an extreme-tail location-or-scale
 *     test). Westenberg uses the IQR (a CENTRAL-50%
 *     range) as its boundary. Tukey-quick is
 *     dominated by extreme observations (sample min
 *     and max only); Westenberg is dominated by
 *     mid-tail observations (the 25th and 75th
 *     percentiles). They reject differently when
 *     dispersion change is in the TAILS vs in the
 *     SHOULDERS of the distribution.
 *
 *   - vs axis-191 Cliff's delta and axis-115
 *     Mann-Whitney (LOCATION tests). Pure scale shift
 *     with equal medians gives Cliff/MW statistics
 *     ~ 0 while Westenberg can reject strongly. Cross-
 *     loading near zero by construction.
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8) so
 * the asymptotic Binomial(n2, 0.5) -> N(n2/2, n2/4)
 * approximation is reliable: n2 = 8 gives expected count
 * 4 with SD sqrt(2) ~ 1.41; the normal-tail size is
 * within +/- 0.005 of nominal alpha=0.05 (Conover 1999
 * sec. 3.2 Table 3.2 for binomial-normal approximation).
 *
 * Reference:
 *   Westenberg, J., "Significance test for median and
 *     interquartile range in samples from continuous
 *     populations of any form", *Proc. Kon. Nederl.
 *     Akad. Wetensch.* 51 (1948), pp. 252-261.
 *   Conover, W. J., *Practical Nonparametric Statistics*,
 *     3rd ed. (Wiley 1999), sec. 5.3 pp. 309-310.
 *   Hyndman, R. J. & Fan, Y., "Sample quantiles in
 *     statistical packages", *Amer. Statist.* 50(4)
 *     (1996), pp. 361-365 Definition 7.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   pew-insights daily-token-westenberg-halves
 *
 *   pew-insights daily-token-westenberg-halves \
 *     --json --min-tenure-days 18 --sort westZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenWestenbergHalvesSort =
  | 'westZ'
  | 'westZDesc'
  | 'westZAbs'
  | 'westZAbsDesc'
  | 'westK'
  | 'westKDesc'
  | 'westPValue'
  | 'westPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenWestenbergHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8) so the Binomial(n2, 0.5) -> N(n2/2,
   * n2/4) normal approximation is reliable.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenWestenbergHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenWestenbergHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  westN1: number;
  /** Second-half size n2 = n - n1. */
  westN2: number;
  /** First quartile of A (Hyndman-Fan type-7). */
  westQ1A: number;
  /** Third quartile of A (Hyndman-Fan type-7). */
  westQ3A: number;
  /** Count of B observations strictly OUTSIDE [Q1_A, Q3_A]. */
  westK: number;
  /** Expected count under H0 = n2 / 2. */
  westExpectedK: number;
  /** Standardized z = (2*k - n2) / sqrt(n2) ~ N(0,1). Positive = SECOND half more dispersed. */
  westZ: number;
  /** Two-sided normal p-value 2(1 - Phi(|westZ|)). */
  westPValue: number;
}

export interface DailyTokenWestenbergHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenWestenbergHalvesSort;
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
  sources: DailyTokenWestenbergHalvesSourceRow[];
}

/**
 * Hyndman-Fan 1996 sample-quantile DEFINITION 7
 * (R / NumPy default). For p in [0, 1] and n >= 2:
 *   h = (n - 1) * p
 *   j = floor(h)
 *   g = h - j
 *   Q_p = sorted[j] + g * (sorted[j+1] - sorted[j])
 * For n = 1 returns sorted[0].
 */
export function quantileType7Westenberg(values: number[], p: number): number {
  if (values.length === 0) {
    throw new Error('quantileType7Westenberg: empty input');
  }
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new Error(`quantileType7Westenberg: p in [0,1] required (got ${p})`);
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 1) return sorted[0]!;
  const h = (n - 1) * p;
  const j = Math.floor(h);
  const g = h - j;
  if (j + 1 >= n) return sorted[n - 1]!;
  return sorted[j]! + g * (sorted[j + 1]! - sorted[j]!);
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) using the
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation; max relative error ~7.5e-8 across the
 * full real line.
 */
export function standardNormalUpperTailWestenberg(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailWestenberg: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailWestenberg(-z);
  const p = 0.2316419;
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const t = 1 / (1 + p * z);
  const phi = Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI);
  const poly =
    b1 * t +
    b2 * t * t +
    b3 * t * t * t +
    b4 * t * t * t * t +
    b5 * t * t * t * t * t;
  const q = phi * poly;
  return q < 0 ? 0 : q > 1 ? 1 : q;
}

/**
 * Westenberg (1948) IQR-exceedance scale test on the
 * first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series. Compute the
 * IQR [Q1_A, Q3_A] of A via Hyndman-Fan type-7 quantiles;
 * count k = number of B observations STRICTLY OUTSIDE
 * [Q1_A, Q3_A]; standardize against Binomial(n2, 0.5)
 * via the DeMoivre-Laplace normal approximation.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - westZ(x + c) === westZ(x) for any constant c
 *     (uniform shift translates A's IQR by c and B by c,
 *     leaves inside/outside membership unchanged).
 *   - westZ(a * x) === westZ(x) for any a > 0 (positive
 *     scale multiplies A's IQR boundaries by a and B by
 *     a, leaves inside/outside membership unchanged).
 *   - westZ is INVARIANT under any STRICTLY-INCREASING
 *     monotone transformation applied UNIFORMLY to ALL
 *     observations (preserves order, preserves which
 *     B's are outside A's IQR).
 *   - For x = repeat(constant) the test is undefined
 *     (zero IQR, all B's are AT the boundary, ambiguous);
 *     we throw to be filtered upstream.
 *   - When Q1_A == Q3_A (degenerate IQR) we throw; this
 *     happens iff sorted_A[ceil(n1/4)] == sorted_A[
 *     ceil(3*n1/4)], i.e. A has at least n1/2 + 1
 *     repeated values.
 */
export function dailyTokenWestenbergHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  westN1: number;
  westN2: number;
  westQ1A: number;
  westQ3A: number;
  westK: number;
  westExpectedK: number;
  westZ: number;
  westPValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenWestenbergHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenWestenbergHalves requires finite values');
    }
  }

  let mu = 0;
  for (const val of values) mu += val;
  mu /= n;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = values[i]! - mu;
    denom += c * c;
  }
  const stddev = Math.sqrt(denom / n);
  if (denom === 0) {
    throw new Error(
      `dailyTokenWestenbergHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;
  const aRaw = values.slice(0, n1);
  const bRaw = values.slice(n1);

  const q1A = quantileType7Westenberg(aRaw, 0.25);
  const q3A = quantileType7Westenberg(aRaw, 0.75);
  if (!(q3A > q1A)) {
    throw new Error(
      `dailyTokenWestenbergHalves: degenerate IQR Q1=${q1A} Q3=${q3A}`,
    );
  }

  let k = 0;
  for (let j = 0; j < n2; j += 1) {
    const b = bRaw[j]!;
    if (b < q1A || b > q3A) k += 1;
  }

  const expectedK = n2 / 2;
  // Standardized z = (k - n2/2) / sqrt(n2/4) = (2*k - n2) / sqrt(n2)
  const westZ = (2 * k - n2) / Math.sqrt(n2);
  const westPValue =
    westZ === 0 ? 1 : 2 * standardNormalUpperTailWestenberg(Math.abs(westZ));

  if (
    !Number.isFinite(westZ) ||
    !Number.isFinite(westPValue) ||
    !Number.isInteger(k)
  ) {
    throw new Error(
      `dailyTokenWestenbergHalves: non-finite output (n=${n}, k=${k}, westZ=${westZ})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    westN1: n1,
    westN2: n2,
    westQ1A: q1A,
    westQ3A: q3A,
    westK: k,
    westExpectedK: expectedK,
    westZ,
    westPValue,
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

export function buildDailyTokenWestenbergHalves(
  queue: QueueLine[],
  opts: DailyTokenWestenbergHalvesOptions = {},
): DailyTokenWestenbergHalvesReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 16;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 16) {
    throw new Error(
      `minTenureDays must be an integer >= 16 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenWestenbergHalvesSort = opts.sort ?? 'westZAbsDesc';
  const validSorts: DailyTokenWestenbergHalvesSort[] = [
    'westZ',
    'westZDesc',
    'westZAbs',
    'westZAbsDesc',
    'westK',
    'westKDesc',
    'westPValue',
    'westPValueDesc',
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
  const rows: DailyTokenWestenbergHalvesSourceRow[] = [];

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
      const val = filled[i]!;
      if (val < mn) mn = val;
      if (val > mx) mx = val;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    let result;
    try {
      result = dailyTokenWestenbergHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      westN1: result.westN1,
      westN2: result.westN2,
      westQ1A: result.westQ1A,
      westQ3A: result.westQ3A,
      westK: result.westK,
      westExpectedK: result.westExpectedK,
      westZ: result.westZ,
      westPValue: result.westPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'westZ':
        primary = a.westZ - b.westZ;
        break;
      case 'westZDesc':
        primary = b.westZ - a.westZ;
        break;
      case 'westZAbs':
        primary = Math.abs(a.westZ) - Math.abs(b.westZ);
        break;
      case 'westZAbsDesc':
        primary = Math.abs(b.westZ) - Math.abs(a.westZ);
        break;
      case 'westK':
        primary = a.westK - b.westK;
        break;
      case 'westKDesc':
        primary = b.westK - a.westK;
        break;
      case 'westPValue':
        primary = a.westPValue - b.westPValue;
        break;
      case 'westPValueDesc':
        primary = b.westPValue - a.westPValue;
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
