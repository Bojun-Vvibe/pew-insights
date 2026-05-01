/**
 * daily-token-sample-entropy: per-source Sample Entropy (SampEn)
 * (Richman & Moorman 2000, Am. J. Physiol. Heart Circ. Physiol.
 * 278:H2039-H2049) on the gap-filled daily total_tokens series.
 *
 * SEVENTY-THIRD cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (same
 * gap-fill convention as axes 67-72). Then:
 *
 *   1. Standard-deviate the gap-filled series s = stddev(x)
 *      (population stddev). Tolerance r = rFactor * s with default
 *      rFactor = 0.2 (the Richman & Moorman canonical value).
 *      Series with s = 0 are surfaced in `droppedZeroVariance`.
 *
 *   2. For embedding dimension m (default 2), build templates of
 *      length m and m+1 by sliding window:
 *        X_m(i) = (x[i], x[i+1], ..., x[i+m-1]),  i = 0..N-m-1
 *        X_{m+1}(i) = (x[i], ..., x[i+m]),        i = 0..N-m-1
 *      Note both index sets have the SAME length (N - m) — this is
 *      the Richman & Moorman correction over Pincus 1991's ApEn.
 *
 *   3. Count UNIQUE-PAIR matches under Chebyshev distance:
 *        A = #{ (i,j) : i < j, max_k |x[i+k] - x[j+k]| <= r,
 *                              k = 0..m   }   (length-(m+1) matches)
 *        B = #{ (i,j) : i < j, max_k |x[i+k] - x[j+k]| <= r,
 *                              k = 0..m-1 }   (length-m matches)
 *      Self-matches (i = j) are EXCLUDED — that's the second
 *      Richman & Moorman correction; ApEn included them and
 *      biased low.
 *
 *   4. SampEn = -ln(A / B).
 *
 *      SampEn is undefined if A = 0 (no length-(m+1) matches at
 *      all — the series is "too irregular" at this r) or if
 *      B = 0 (no length-m matches — series too short or r too
 *      tight). Following the standard practice we surface these
 *      as `droppedZeroAMatches` / `droppedZeroBMatches` rather
 *      than reporting -Infinity. Operators wanting to chart
 *      "very irregular" sources should loosen rFactor.
 *
 *      Larger SampEn = more irregular / less self-similar at
 *      length m+1. SampEn = 0 means every length-m match also
 *      extends to length m+1 (perfect short-window predictability).
 *
 * Headline question:
 * **"For each source, how much HARDER is it to find a length-3
 *   matching template than a length-2 matching template, in the
 *   gap-filled daily-token series, at tolerance r = 0.2 * stddev?"**
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY NEW
 * PRIMITIVE NOT COVERED BY ANY SHIPPED DAILY-TOKEN AXIS 32..72:
 *
 *   - vs `daily-token-permutation-entropy` (axis 70): PE is
 *     ORDINAL — it categorises each length-m+1 window into one of
 *     (m+1)! rank patterns and ignores the actual distances.
 *     SampEn is METRIC and uses Chebyshev distance with a fixed
 *     tolerance r. Two series with identical PE can have wildly
 *     different SampEn (e.g. shrink the amplitude of every other
 *     point by 1000x: rank patterns unchanged, SampEn collapses
 *     because all distances are now tiny relative to the global
 *     stddev that defines r). PE is invariant under any strictly
 *     monotone per-point transform; SampEn only under positive
 *     affine.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): SE summarises
 *     the FLATNESS of the global periodogram (a frequency-domain
 *     spectral measure). SampEn is purely TIME-DOMAIN and counts
 *     short-template recurrence at a single embedding dimension.
 *     A pure 1/f noise and a pure white noise both have flat-ish
 *     spectra in different ways; their SampEn at m=2 differs by
 *     a factor of ~2 at standard r. Rankings do not preserve.
 *
 *   - vs `daily-token-acf-lag1` / `daily-token-acf-lag7` (axes
 *     67/68): ACF is a SECOND-MOMENT linear scalar at one fixed
 *     lag. SampEn is a NONLINEAR multi-point counting statistic.
 *     Standard counter-example: a sinusoid x[t] = sin(2 pi t / 7)
 *     has rho_7 near 1 (perfect self-correlation at lag 7) AND
 *     SampEn near 0 (deterministic). A surrogate with the same
 *     ACF but randomised phases has the same rho values and
 *     much higher SampEn.
 *
 *   - vs `daily-token-hurst-rs` (axis 71) and `daily-token-dfa-
 *     alpha` (axis 72): both are SCALING / multi-scale
 *     LONG-RANGE memory exponents (how cumulative-deviation
 *     spread or detrended residual rms scales with window
 *     length). SampEn is SHORT-WINDOW and SINGLE-SCALE (one
 *     embedding m + one tolerance r); it is finite even for
 *     series with no long-range memory at all. Witness: take
 *     IID uniform noise — alpha and H both ~0.5 (white-noise
 *     memory), SampEn ~ 2.2 (high irregularity at m=2,
 *     r=0.2 sigma). Take a periodic wave — alpha pegs near 1.0
 *     (clamped artifact), SampEn pegs near 0 (perfect
 *     repeatability). Rankings invert.
 *
 *   - vs all permutation-invariant dispersion / shape axes
 *     32..67 (Gini, Atkinson, Theil, GE, Hill, MC, L-skew,
 *     ...): those throw away temporal placement entirely. A
 *     sorted and a shuffled copy of the same multiset produce
 *     IDENTICAL Gini / Atkinson / etc. and very different
 *     SampEn (sorted -> SampEn ~ 0 once amplitudes cluster
 *     near self under the m=2 sliding window; shuffled ->
 *     SampEn at the IID-uniform asymptote). See the
 *     `orthogonality witness: sorted-vs-shuffled multiset`
 *     test.
 *
 * Caveats:
 *
 *   - SampEn is not defined when N is too small to have at
 *     least one (i,j) pair with i<j inside the (N-m)-length
 *     index set. We require nTenure >= minTenureDays (default
 *     32) so N - m >= 30 pairs at m=2 in the worst case.
 *   - SampEn at fixed (m, r) is sensitive to the choice of r;
 *     we expose `--r-factor` and default to 0.2 (Richman &
 *     Moorman canonical) but operators sweeping r will see
 *     monotone-ish curves rather than rank-preserving ones.
 *   - All-zero gap-fill stretches reduce stddev and thus the
 *     absolute tolerance r; very sparse sources can drop into
 *     droppedZeroVariance even when they have a few non-zero
 *     bursts. The `--min-tokens` floor mitigates but does not
 *     eliminate this.
 *   - SampEn is biased UPWARD on short series (Lake et al.
 *     2002); treat the absolute number as ordinal across
 *     sources of similar tenure, not as a stationarity-free
 *     point estimate.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * References:
 *   Richman, J.S. & Moorman, J.R., "Physiological time-series
 *     analysis using approximate entropy and sample entropy",
 *     Am. J. Physiol. Heart Circ. Physiol. 278:H2039-H2049, 2000.
 *   Lake, D.E., Richman, J.S., Griffin, M.P., Moorman, J.R.,
 *     "Sample entropy analysis of neonatal heart rate
 *     variability", Am. J. Physiol. Regul. Integr. Comp. Physiol.
 *     283:R789-R797, 2002.
 */
import type { QueueLine } from './types.js';

/** Default embedding dimension m. */
export const DEFAULT_SAMPEN_M = 2;
/** Default tolerance scale r = rFactor * stddev. */
export const DEFAULT_SAMPEN_R_FACTOR = 0.2;

export type DailyTokenSampleEntropySort =
  | 'sampEnDesc'
  | 'sampEn'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSampleEntropyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor m + 30 so we
   * always have at least 30 length-(m+1) templates. Default 32.
   */
  minTenureDays?: number;
  /** Embedding dimension m. Hard floor 1, default 2. */
  m?: number;
  /** Tolerance multiplier r = rFactor * stddev. Default 0.2. */
  rFactor?: number;
  top?: number;
  sort?: DailyTokenSampleEntropySort;
  generatedAt?: string;
}

export interface DailyTokenSampleEntropySourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Sample Entropy = -ln(A/B) at (m, r). Always finite when reported. */
  sampEn: number;
  /** Population stddev of the gap-filled series (used to scale r). */
  stddev: number;
  /** Absolute tolerance r = rFactor * stddev. */
  rAbsolute: number;
  /** Count A: unique-pair length-(m+1) matches under Chebyshev. */
  matchesAplusone: number;
  /** Count B: unique-pair length-m matches under Chebyshev. */
  matchesB: number;
}

export interface DailyTokenSampleEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  m: number;
  rFactor: number;
  top: number;
  sort: DailyTokenSampleEntropySort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedZeroBMatches: number;
  droppedZeroAMatches: number;
  droppedTopSources: number;
  sources: DailyTokenSampleEntropySourceRow[];
}

/**
 * Sample Entropy on a real-valued series. Returns sampEn,
 * the unique-pair counts A and B, and the absolute tolerance r.
 *
 * Throws when the series has zero variance (r would be 0 and
 * every pair trivially matches), when no length-m matches exist
 * (B = 0), or when no length-(m+1) matches exist (A = 0). Caller
 * should catch and surface as droppedZeroVariance /
 * droppedZeroBMatches / droppedZeroAMatches at the source level.
 *
 * Algorithm (Richman & Moorman 2000):
 *   1. r = rFactor * stddev(values)
 *   2. For i, j in [0, N-m), i < j:
 *      d_m  = max_{k=0..m-1} |x[i+k] - x[j+k]|
 *      d_m1 = max(d_m, |x[i+m] - x[j+m]|)
 *      if d_m  <= r: B += 1
 *      if d_m1 <= r: A += 1
 *   3. SampEn = -ln(A / B)
 */
export function sampleEntropy(
  values: number[],
  opts: { m?: number; rFactor?: number } = {},
): {
  sampEn: number;
  stddev: number;
  rAbsolute: number;
  matchesAplusone: number;
  matchesB: number;
} {
  const m = opts.m ?? DEFAULT_SAMPEN_M;
  const rFactor = opts.rFactor ?? DEFAULT_SAMPEN_R_FACTOR;
  if (!Number.isInteger(m) || m < 1) {
    throw new Error(`sampleEntropy: m must be a positive integer (got ${m})`);
  }
  if (!Number.isFinite(rFactor) || rFactor <= 0) {
    throw new Error(
      `sampleEntropy: rFactor must be a positive finite number (got ${rFactor})`,
    );
  }
  const n = values.length;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('sampleEntropy requires finite values');
    }
  }
  // Need at least N - m >= 2 templates to form a single (i,j) pair.
  if (n < m + 2) {
    throw new Error(
      `sampleEntropy: series too short (n=${n}, need n >= m+2 = ${m + 2})`,
    );
  }

  // Population stddev.
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += values[i]!;
  const mu = sum / n;
  let s2 = 0;
  for (let i = 0; i < n; i += 1) {
    const d = values[i]! - mu;
    s2 += d * d;
  }
  const sd = Math.sqrt(s2 / n);
  if (sd === 0) {
    throw new Error('sampleEntropy: zero variance (r would be 0)');
  }
  const r = rFactor * sd;

  // Number of length-m and length-(m+1) templates: both N - m
  // (Richman & Moorman correction over ApEn).
  const ntmpl = n - m;
  let A = 0;
  let B = 0;
  for (let i = 0; i < ntmpl; i += 1) {
    for (let j = i + 1; j < ntmpl; j += 1) {
      // Chebyshev distance over k = 0..m-1.
      let dm = 0;
      let bad = false;
      for (let k = 0; k < m; k += 1) {
        const e = Math.abs(values[i + k]! - values[j + k]!);
        if (e > r) {
          bad = true;
          break;
        }
        if (e > dm) dm = e;
      }
      if (bad) continue;
      B += 1;
      const eExt = Math.abs(values[i + m]! - values[j + m]!);
      if (eExt <= r) A += 1;
    }
  }

  if (B === 0) {
    throw new Error('sampleEntropy: zero length-m matches (B=0)');
  }
  if (A === 0) {
    throw new Error('sampleEntropy: zero length-(m+1) matches (A=0)');
  }
  const sampEn = -Math.log(A / B);
  return {
    sampEn,
    stddev: sd,
    rAbsolute: r,
    matchesAplusone: A,
    matchesB: B,
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

export function buildDailyTokenSampleEntropy(
  queue: QueueLine[],
  opts: DailyTokenSampleEntropyOptions = {},
): DailyTokenSampleEntropyReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const m = opts.m ?? DEFAULT_SAMPEN_M;
  if (!Number.isInteger(m) || m < 1) {
    throw new Error(`m must be a positive integer (got ${opts.m})`);
  }
  const rFactor = opts.rFactor ?? DEFAULT_SAMPEN_R_FACTOR;
  if (!Number.isFinite(rFactor) || rFactor <= 0) {
    throw new Error(
      `rFactor must be a positive finite number (got ${opts.rFactor})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < m + 30) {
    throw new Error(
      `minTenureDays must be an integer >= m+30 = ${m + 30} (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenSampleEntropySort = opts.sort ?? 'sampEnDesc';
  const validSorts: DailyTokenSampleEntropySort[] = [
    'sampEnDesc',
    'sampEn',
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
    let accSrc = agg.get(src);
    if (!accSrc) {
      accSrc = {
        perDay: new Map<string, number>(),
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, accSrc);
    }
    accSrc.perDay.set(day, (accSrc.perDay.get(day) ?? 0) + tt);
    accSrc.totalTokens += tt;
    if (day < accSrc.firstDay) accSrc.firstDay = day;
    if (day > accSrc.lastDay) accSrc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let droppedBelowMinTenure = 0;
  let droppedZeroVariance = 0;
  let droppedZeroBMatches = 0;
  let droppedZeroAMatches = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenSampleEntropySourceRow[] = [];

  for (const [src, accSrc] of agg) {
    if (accSrc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nTenure = dayDiffInclusive(accSrc.firstDay, accSrc.lastDay);
    if (nTenure < minTenureDays) {
      droppedBelowMinTenure += 1;
      continue;
    }
    const filled: number[] = new Array(nTenure);
    let cursor = accSrc.firstDay;
    for (let i = 0; i < nTenure; i += 1) {
      filled[i] = accSrc.perDay.get(cursor) ?? 0;
      cursor = addUtcDays(cursor, 1);
    }
    let result;
    try {
      result = sampleEntropy(filled, { m, rFactor });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('zero variance')) droppedZeroVariance += 1;
      else if (msg.includes('B=0')) droppedZeroBMatches += 1;
      else if (msg.includes('A=0')) droppedZeroAMatches += 1;
      else throw e;
      continue;
    }
    rows.push({
      source: src,
      totalTokens: accSrc.totalTokens,
      nActiveDays: accSrc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: accSrc.firstDay,
      lastActiveDay: accSrc.lastDay,
      sampEn: result.sampEn,
      stddev: result.stddev,
      rAbsolute: result.rAbsolute,
      matchesAplusone: result.matchesAplusone,
      matchesB: result.matchesB,
    });
    totalTokensSum += accSrc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'sampEn':
        primary = a.sampEn - b.sampEn;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'tenure':
        primary = b.nTenureDays - a.nTenureDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'sampEnDesc':
      default:
        primary = b.sampEn - a.sampEn;
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
    m,
    rFactor,
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
    droppedZeroBMatches,
    droppedZeroAMatches,
    droppedTopSources,
    sources: kept,
  };
}
