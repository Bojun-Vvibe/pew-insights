/**
 * daily-token-lempel-ziv-complexity: per-source Lempel-Ziv (LZ76)
 * complexity of the median-binarised gap-filled daily total_tokens
 * series.
 *
 * EIGHTY-THIRD cross-source axis.
 *
 * Operationally: form the binary symbol sequence
 *
 *   s[i] = 1   if y[i] >  median(y)
 *   s[i] = 0   if y[i] <= median(y)
 *
 * Then run the canonical Lempel-Ziv 1976 sequential parsing of `s`
 * into a minimal set of distinct PHRASES: scan left-to-right and at
 * each position extend the current candidate phrase as long as it is
 * still a substring of the prefix already parsed; when extension
 * would produce a phrase NOT seen before, close the current phrase
 * and start a new one. The complexity `c(n)` is the number of
 * phrases produced.
 *
 *   lzCount = c(n)
 *   lzRate  = c(n) / n
 *   lzNormalized = c(n) / b(n),
 *     where b(n) = n / log2(n) is the Lempel-Ziv asymptotic upper
 *     bound for binary iid sequences (Lempel & Ziv 1976,
 *     theorem 2).
 *
 * `lzNormalized` is bounded above by ~1 for sufficiently long
 * binary white-noise input and trends to 0 for a perfectly
 * predictable / periodic sequence.
 *
 * REFERENCES:
 *
 *   Lempel, A., Ziv, J., "On the complexity of finite sequences",
 *     IEEE Trans. Inf. Theory IT-22(1):75-81, 1976.
 *   Kaspar, F., Schuster, H. G., "Easily calculable measure for the
 *     complexity of spatiotemporal patterns", Phys. Rev. A
 *     36(2):842-848, 1987 (the standard binary-symbolisation +
 *     median-threshold recipe used here).
 *   Aboy, M., Hornero, R., Abasolo, D., Alvarez, D., "Interpretation
 *     of the Lempel-Ziv complexity measure in the context of
 *     biomedical signal analysis", IEEE Trans. Biomed. Eng.
 *     53(11):2282-2288, 2006 (normalisation by n / log_alpha(n)).
 *
 * STRUCTURAL ORTHOGONALITY -- ALGORITHMIC / STRING-COMPRESSION
 * complexity, fundamentally distinct from every shipped daily-token
 * axis 32..82:
 *
 *   - vs `daily-token-curvature-sign-change-rate` (axis 82) /
 *     `daily-token-petrosian-fd` (axis 76): CSC and PFD are LOCAL
 *     sign-change counts on derivatives; LZ is a GLOBAL count of
 *     distinct substrings in a binarised stream and depends on
 *     long-range structure (a periodic alternation has high PFD
 *     and high CSC but very LOW LZ because the same short phrase
 *     repeats forever).
 *
 *   - vs `daily-token-teager-kaiser-energy` (axis 81): TKE is a
 *     QUADRATIC magnitude-aware operator on triplets; LZ throws
 *     away every magnitude beyond the median split and operates on
 *     the resulting bit string only.
 *
 *   - vs `daily-token-hjorth-mobility` (79) / `daily-token-hjorth-
 *     complexity` (80): Hjorth axes are GLOBAL ratios of three
 *     sample VARIANCES; LZ is a STRING-COMBINATORIAL count.
 *
 *   - vs `daily-token-box-count-fd` (78) / `daily-token-sevcik-fd`
 *     (77) / `daily-token-katz-fd` (75) / `daily-token-higuchi-fd`
 *     (74): geometric path-length / coverage scaling primitives;
 *     LZ is symbolic / dictionary-based and has no notion of
 *     embedding distance.
 *
 *   - vs `daily-token-hurst-rs` (71) / `daily-token-dfa-alpha`
 *     (72): scale-dependent variance of cumulative deviations;
 *     LZ ignores the cumulative structure entirely.
 *
 *   - vs `daily-token-spectral-entropy` (69): Shannon entropy of
 *     the FOURIER power spectrum; LZ is the Shannon-equivalent
 *     COMPLEXITY of the time-domain symbol sequence and can rise
 *     even when the spectrum is concentrated (e.g. an
 *     aperiodic-but-narrowband modulation).
 *
 *   - vs `daily-token-permutation-entropy` (70) / `daily-token-
 *     sample-entropy` (73): both quantify pattern repetition in
 *     ordinal / template windows of fixed length; LZ uses
 *     VARIABLE-length phrase parsing and is sensitive to
 *     long-range structure that fixed-window entropies miss.
 *
 *   - vs autocorrelation axes 67/68: linear second-order
 *     statistics; LZ is non-linear and order-of-magnitude blind
 *     after the median binarisation.
 *
 *   - vs all permutation-invariant dispersion / shape axes 32-67:
 *     they are SHUFFLE-INVARIANT. LZ is SHUFFLE-SENSITIVE because
 *     reshuffling the days changes which substrings appear.
 *
 * INVARIANCES of lzCount (after the median binarisation):
 *   - SHIFT: median shifts identically with the data, so the
 *     above-/at-or-below-median labelling is preserved. SHIFT-
 *     INVARIANT.
 *   - SCALE (k > 0): median scales by k, the binary labels are
 *     unchanged. SCALE-INVARIANT for k > 0.
 *   - SIGN-FLIP combined with median re-fit: under y -> -y, the
 *     median negates and the strict ">" comparison flips every
 *     bit of `s`. Under the LZ76 dictionary construction, the
 *     phrase complexity of a binary sequence and of its bitwise
 *     complement are EQUAL (the dictionary structure is symmetric
 *     in 0/1). So LZ is SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL: LZ76 is generally NOT time-reversal-
 *     invariant; reversing the sequence can change the parse.
 *     This is a useful asymmetry vs CSC / PFD which ARE time-
 *     reversal-invariant.
 *   - MONOTONE-RESCALING: any strictly increasing transform
 *     leaves the median split unchanged. LZ is therefore robust
 *     to arbitrary monotone re-encoding of the daily-token scale.
 *   - SHUFFLE: NOT invariant -- reordering the days changes which
 *     substrings appear in the parsed dictionary.
 */
import type { QueueLine } from './types.js';

export type DailyTokenLempelZivComplexitySort =
  | 'lzNormalizedDesc'
  | 'lzNormalized'
  | 'lzRate'
  | 'lzRateDesc'
  | 'lzCount'
  | 'lzCountDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenLempelZivComplexityOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that the
   * binarised series is long enough to make `n / log2(n)` finite
   * and meaningful (n >= 8 -> log2(n) >= 3).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenLempelZivComplexitySort;
  generatedAt?: string;
}

export interface DailyTokenLempelZivComplexitySourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Median of the gap-filled daily series. */
  median: number;
  /** Number of "1" bits (days strictly above the median). */
  onesCount: number;
  /** LZ76 phrase count of the median-binarised sequence. */
  lzCount: number;
  /** lzCount / n. */
  lzRate: number;
  /** lzCount / (n / log2(n)); white-noise reference ~ 1. */
  lzNormalized: number;
}

export interface DailyTokenLempelZivComplexityReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenLempelZivComplexitySort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedDegenerateBinarisation: number;
  droppedNonFiniteLz: number;
  droppedTopSources: number;
  sources: DailyTokenLempelZivComplexitySourceRow[];
}

/**
 * Median of a numeric array. For even n, returns the average of the
 * two central order statistics. Mutates a local copy only.
 *
 * Throws when the array is empty or contains a non-finite value.
 */
export function median(values: number[]): number {
  const n = values.length;
  if (n === 0) {
    throw new Error('median: empty array');
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('median requires finite values');
    }
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (n % 2 === 1) {
    return sorted[(n - 1) / 2]!;
  }
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/**
 * Median-threshold binarisation: returns a 0/1 string with `1` for
 * entries strictly greater than the median, `0` otherwise. Length
 * matches input.
 */
export function medianBinarise(values: number[]): string {
  const m = median(values);
  let out = '';
  for (const v of values) {
    out += v > m ? '1' : '0';
  }
  return out;
}

/**
 * Lempel-Ziv 1976 phrase count `c(n)` of a binary string.
 *
 * Implements the canonical sequential parsing: maintain a "history"
 * window of bits already absorbed into the dictionary, and a
 * candidate phrase that grows by one bit at a time. As long as the
 * candidate phrase is found anywhere inside `history + candidate
 * (without the last bit)` we keep extending; the moment it fails
 * we close the candidate as a new phrase, fold it into the history,
 * and start a fresh candidate at the next bit. The final
 * (possibly incomplete) candidate also counts as one phrase.
 *
 * Worst-case O(n^2) due to the naive substring search; acceptable
 * for the daily-token series we work with (n typically < 1000).
 *
 * Throws on empty input or on a string containing characters other
 * than '0' / '1'.
 */
export function lempelZivPhraseCount(bits: string): number {
  const n = bits.length;
  if (n === 0) {
    throw new Error('lempelZivPhraseCount: empty input');
  }
  for (let i = 0; i < n; i += 1) {
    const ch = bits.charCodeAt(i);
    if (ch !== 48 && ch !== 49) {
      throw new Error(
        `lempelZivPhraseCount: non-binary character at index ${i}`,
      );
    }
  }

  let c = 1; // first bit is always a new phrase by itself
  let i = 1; // start of current candidate
  let l = 1; // current candidate length
  let kMax = 1; // longest match length seen at this start position

  while (i + l <= n) {
    // Substring `bits.slice(i, i + l)` -- does it appear inside
    // `bits.slice(0, i + l - 1)` (history including all-but-last
    // bit of the current candidate)?
    const sub = bits.slice(i, i + l);
    const haystackEnd = i + l - 1;
    const found = bits.lastIndexOf(sub, haystackEnd - sub.length) !== -1;
    if (found) {
      if (l > kMax) kMax = l;
      l += 1;
      if (i + l > n) {
        // Hit the end of the buffer mid-extension: the trailing
        // candidate still counts as one phrase.
        c += 1;
        break;
      }
    } else {
      // Close current phrase and start a new one.
      c += 1;
      i += l;
      l = 1;
      kMax = 1;
    }
  }

  return c;
}

/**
 * Daily-token LZ complexity primitive on a real-valued series.
 *
 * Returns the median value, the binarised "ones" count, the LZ76
 * phrase count, the per-bit rate, and the white-noise-normalised
 * complexity `c(n) / (n / log2(n))`.
 *
 * Throws when the series is too short (n < 8 -- need log2(n) >= 3
 * for a meaningful normalisation), when a non-finite value is
 * present, when var(y) is exactly 0, or when the binarisation
 * collapses to a constant string (every value equal to the
 * median to within ties).
 */
export function dailyTokenLempelZivComplexity(values: number[]): {
  median: number;
  onesCount: number;
  lzCount: number;
  lzRate: number;
  lzNormalized: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenLempelZivComplexity: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('dailyTokenLempelZivComplexity requires finite values');
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
      'dailyTokenLempelZivComplexity: zero variance (constant series)',
    );
  }

  const bits = medianBinarise(values);
  let onesCount = 0;
  for (let i = 0; i < bits.length; i += 1) {
    if (bits[i] === '1') onesCount += 1;
  }
  if (onesCount === 0 || onesCount === n) {
    throw new Error(
      'dailyTokenLempelZivComplexity: degenerate binarisation (all bits identical after median split)',
    );
  }

  const med = median(values);
  const c = lempelZivPhraseCount(bits);
  const lzRate = c / n;
  const upper = n / Math.log2(n);
  const lzNormalized = c / upper;

  if (
    !Number.isFinite(lzRate) ||
    !Number.isFinite(lzNormalized) ||
    !Number.isFinite(upper)
  ) {
    throw new Error(
      `dailyTokenLempelZivComplexity: non-finite result (lzRate=${lzRate}, lzNormalized=${lzNormalized})`,
    );
  }

  return {
    median: med,
    onesCount,
    lzCount: c,
    lzRate,
    lzNormalized,
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

export function buildDailyTokenLempelZivComplexity(
  queue: QueueLine[],
  opts: DailyTokenLempelZivComplexityOptions = {},
): DailyTokenLempelZivComplexityReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 8) {
    throw new Error(
      `minTenureDays must be an integer >= 8 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenLempelZivComplexitySort =
    opts.sort ?? 'lzNormalizedDesc';
  const validSorts: DailyTokenLempelZivComplexitySort[] = [
    'lzNormalizedDesc',
    'lzNormalized',
    'lzRate',
    'lzRateDesc',
    'lzCount',
    'lzCountDesc',
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
  let droppedDegenerateBinarisation = 0;
  let droppedNonFiniteLz = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenLempelZivComplexitySourceRow[] = [];

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
      result = dailyTokenLempelZivComplexity(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('degenerate binarisation')) {
        droppedDegenerateBinarisation += 1;
      } else {
        droppedNonFiniteLz += 1;
      }
      continue;
    }
    rows.push({
      source: src,
      totalTokens: accSrc.totalTokens,
      nActiveDays: accSrc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: accSrc.firstDay,
      lastActiveDay: accSrc.lastDay,
      median: result.median,
      onesCount: result.onesCount,
      lzCount: result.lzCount,
      lzRate: result.lzRate,
      lzNormalized: result.lzNormalized,
    });
    totalTokensSum += accSrc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'lzNormalized':
        primary = a.lzNormalized - b.lzNormalized;
        break;
      case 'lzNormalizedDesc':
        primary = b.lzNormalized - a.lzNormalized;
        break;
      case 'lzRate':
        primary = a.lzRate - b.lzRate;
        break;
      case 'lzRateDesc':
        primary = b.lzRate - a.lzRate;
        break;
      case 'lzCount':
        primary = a.lzCount - b.lzCount;
        break;
      case 'lzCountDesc':
        primary = b.lzCount - a.lzCount;
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
    droppedDegenerateBinarisation,
    droppedNonFiniteLz,
    droppedTopSources,
    sources: kept,
  };
}
