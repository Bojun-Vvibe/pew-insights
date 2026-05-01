/**
 * daily-token-permutation-entropy: per-source Bandt-Pompe (2002)
 * normalised permutation entropy of the gap-filled daily total_tokens
 * series.
 *
 * SEVENTIETH cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (so we
 * have a dense, evenly-spaced length-N series). Then:
 *
 *   1. Slide an embedding window of length m over the series at lag
 *      tau = 1, producing W = N - (m-1)*tau = N - m + 1 windows
 *      x[i], x[i+1], ..., x[i+m-1] for i = 0..W-1.
 *
 *   2. Each window is mapped to the permutation pi in S_m that
 *      sorts it into ascending order (the "ordinal pattern"). Ties
 *      are broken by EARLIER-INDEX-WINS (a deterministic stable
 *      tie-break -- Cao et al. 2004 convention) so the encoding is
 *      total even on the all-zero windows that arise from gap-fill.
 *
 *   3. Count the occurrences of each of the m! ordinal patterns
 *      over the W windows; normalise into a probability vector
 *      p_pi = count_pi / W.
 *
 *   4. Normalised Shannon entropy in [0, 1]:
 *
 *        H_PE = -sum_pi p_pi * ln(p_pi) / ln(m!)
 *
 *      with the standard 0 * ln(0) = 0 convention. By construction
 *      H_PE in [0, 1].
 *
 * Default embedding m = 3, so m! = 6 ordinal patterns
 * { 012, 021, 102, 120, 201, 210 }. m=3 is the smallest m with at
 * least 4 distinct patterns (m=2 yields only "up" / "down" which is
 * already covered by sign-trace axes); it is also the embedding for
 * which the Bandt-Pompe paper reports the cleanest separation of
 * stochastic vs chaotic signals on short series, and it requires
 * only N >= W+m-1 = m+1 = 4 days of tenure (so the same hard floor
 * as the spectral axis).
 *
 * Headline question:
 * **"For each source, how evenly is the daily-token series spread
 *   across the m! possible ORDINAL PATTERNS of three consecutive
 *   days, vs concentrated in a few characteristic up/down/flat
 *   shapes?"**
 *
 *   - H_PE = 1.0 : all m! patterns occur with equal frequency
 *     (maximally complex ordinal structure -- the local up/down
 *     micro-trajectories carry no preferred shape).
 *   - H_PE = 0.0 : a single ordinal pattern carries 100% of the
 *     mass (a strictly-monotone series -- e.g. linearly increasing
 *     produces only the 012 pattern).
 *   - H_PE in between: partial ordinal regularity.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY NEW
 * PRIMITIVE NOT COVERED BY ANY SHIPPED AXIS 32..69:
 *
 *   - vs `daily-token-spectral-entropy` (axis 69, Shannon on the
 *     PERIODOGRAM): spectral entropy is invariant under any
 *     reordering that preserves the autocovariance sequence, and a
 *     pure cosine has H_spec near 0 with H_PE ~= ln(4)/ln(6) (only
 *     4 of the 6 patterns occur for a strictly-periodic monotone-
 *     between-extrema cosine sample). Conversely a strictly-
 *     monotone-increasing ramp has H_spec near 0 (all power in the
 *     lowest bin) AND H_PE = 0 (only pattern 012). And a uniform-
 *     iid series has H_spec near 1 (white) and H_PE near 1 (all
 *     patterns equiprobable). The two axes coincide at extremes
 *     but disagree on the middle of the complexity-randomness
 *     plane -- the canonical Rosso et al. 2007 "complexity-
 *     entropy plane" exploits exactly this gap.
 *
 *   - vs lag-1 / lag-7 Pearson autocorrelation (axes 67/68): rho
 *     is a single linear-correlation scalar at a chosen lag and is
 *     INVARIANT under any monotone affine transform x -> a*x + b
 *     with a > 0. Permutation entropy is invariant under any
 *     STRICTLY MONOTONE transform (not just affine), but is also
 *     defined for series whose Pearson correlation at every lag is
 *     0 yet whose ordinal patterns are heavily skewed (a single
 *     non-affine monotone trajectory).
 *
 *   - vs ALL permutation-invariant dispersion / shape axes 32..67
 *     (Gini, Atkinson, Theil, GE, Hoover, Pietra, Bonferroni,
 *     Mehran, Wolfson, Palma, Kolm-Pollak, Chakravarty, Amato,
 *     Esteban-Ray, Var-of-Logs, Log-MAD, FGT, PGR, IOM, MSR, DSG,
 *     QSR, MADM, Zenga, Hill, MC, L-skew): those throw away the
 *     temporal placement entirely (they are invariant under ANY
 *     permutation of the sequence). Permutation entropy is
 *     defined precisely on the ordinal placement -- a sorted and
 *     a shuffled copy of the same multiset produce H_PE = 0 and
 *     H_PE near 1 respectively while every multiset statistic is
 *     identical.
 *
 *   - vs sign-trace / runs-test / monotone-run-length axes (axes
 *     based on first-difference SIGNS only): a sign trace is
 *     equivalent to the m=2 ordinal alphabet { up, down } and
 *     loses all information about the relative ordering of
 *     non-adjacent points within a window. With m=3 we resolve
 *     six patterns including the two "peak" shapes 120 / 021 and
 *     the two "valley" shapes 201 / 102, which collapse onto the
 *     same up-down sign pair under m=2.
 *
 *   - vs trend / forecast / source-daily-token-trend-slope: a
 *     linear ramp has H_PE = 0 (only pattern 012 occurs) AND a
 *     non-zero trend slope -- they agree at the strict-monotonic
 *     extreme but H_PE also drops sharply for non-linear monotone
 *     trajectories (e.g. exponential growth) where a least-squares
 *     slope alone does not characterise the shape. Conversely a
 *     mean-zero high-frequency oscillation has slope near 0 and
 *     H_PE near ln(6)/ln(6) = 1.
 *
 *   - vs amplitude-domain Shannon entropy axes (e.g. source-row-
 *     token-temporal-entropy): those compute Shannon directly on
 *     the normalised AMPLITUDE distribution; permutation entropy
 *     computes Shannon on the ORDINAL-PATTERN distribution
 *     (categorical alphabet of size m! independent of amplitude).
 *     A series with a single dominant amplitude spike has low
 *     amplitude-Shannon (one row carries all mass) but ordinal
 *     entropy can still be high (many distinct up/down patterns
 *     around the spike).
 *
 * Bound: H_PE in [0, 1]. flat=true marks sources with W < 1 (cannot
 * happen at the default minTenureDays=14 / m=3 floor) or where every
 * window collapses to a single repeated pattern (e.g. a constant
 * series produces only the all-tied window which under earlier-
 * index-wins maps to pattern 012 -- so H_PE reports 0, NOT flat).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor; counts surface as droppedSparseSources.
 *   - `minTenureDays` (default 14): require gap-filled tenure >=
 *     this many calendar days. Hard floor m+1 = 4 (need W >= 1
 *     window). Default 14 matches the spectral axis for cross-
 *     comparability; at N=14 there are W = 12 windows, enough to
 *     populate several of the 6 patterns.
 *   - `top` (default 0 = no cap): display cap.
 *   - `sort` (default 'entropy'): 'entropy' (most-ordinally-
 *     concentrated first; H_PE ascending) | 'entropyDesc' (most
 *     ordinally-complex first; H_PE descending) | 'tokens' |
 *     'tenure' | 'source'.
 *   - `maxEntropy`: display filter; hide non-flat rows with
 *     H_PE > this (surface only the most ordinally-regular sources).
 *
 * References:
 *   Bandt & Pompe, "Permutation entropy: A natural complexity
 *     measure for time series", PRL 88(17), 2002.
 *   Cao, Tung, Gao, Protopopescu & Hively, "Detecting dynamical
 *     changes in time series using the permutation entropy",
 *     Phys. Rev. E 70, 046217, 2004 (deterministic tie-break).
 *   Rosso et al., "Distinguishing noise from chaos", PRL 99, 154102,
 *     2007 (complexity-entropy plane interpretation).
 */
import type { QueueLine } from './types.js';

/** Embedding dimension. Fixed to 3 in the public CLI surface. */
export const PE_EMBEDDING_M = 3;
/** Number of ordinal patterns = m!. */
export const PE_PATTERN_COUNT = 6;

export type DailyTokenPermutationEntropySort =
  | 'entropy'
  | 'entropyDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenPermutationEntropyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Must be >= m+1 = 4.
   * Default 14 (matches the spectral axis floor for cross-axis
   * comparability and yields W=12 windows).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenPermutationEntropySort;
  /** Display filter: drop non-flat rows with H_PE > this. null = no filter. */
  maxEntropy?: number | null;
  generatedAt?: string;
}

export interface DailyTokenPermutationEntropySourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days = lastActive - firstActive + 1. */
  nTenureDays: number;
  /** Number of m=3 sliding windows = nTenureDays - 2. */
  nWindows: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /**
   * Argmax pattern code in {0..5} under canonical lexicographic
   * ordering of S_3:
   *   0 = "012" (strictly increasing),
   *   1 = "021" (peak at middle index 1),
   *   2 = "102" (valley at middle index 1's predecessor),
   *   3 = "120" (peak at middle index 1; mirror of 021),
   *   4 = "201" (valley at first index),
   *   5 = "210" (strictly decreasing).
   * Reported as -1 when flat (W < 1).
   */
  peakPattern: number;
  /** p_pi of the argmax pattern. Reported as 0 when flat. */
  peakShare: number;
  /**
   * Per-pattern probability vector p_pi indexed by the same
   * 0..5 codes as peakPattern. Length always 6.
   */
  patternShares: number[];
  /** Normalised Shannon permutation entropy in [0, 1]. 0 with flat=true when W < 1. */
  entropyNorm: number;
  /** True iff there are no sliding windows (cannot happen at minTenureDays >= 4). */
  flat: boolean;
}

export interface DailyTokenPermutationEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  embeddingM: number;
  patternCount: number;
  top: number;
  sort: DailyTokenPermutationEntropySort;
  maxEntropy: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedAboveMaxEntropy: number;
  droppedTopSources: number;
  sources: DailyTokenPermutationEntropySourceRow[];
}

/**
 * Lehmer-style ordinal-pattern code for a length-3 window under
 * the EARLIER-INDEX-WINS tie-break (Cao et al. 2004). Returns an
 * integer in {0..5} matching the lexicographic ordering of S_3:
 *
 *   pattern code -> permutation pi (rank positions of the three
 *   values, ascending; pi[i] = "the input index whose value comes
 *   i-th in ascending order with ties broken by smaller-index-wins"):
 *
 *     0 = (0,1,2) -> "012", strictly increasing
 *     1 = (0,2,1) -> "021"
 *     2 = (1,0,2) -> "102"
 *     3 = (1,2,0) -> "120"
 *     4 = (2,0,1) -> "201"
 *     5 = (2,1,0) -> "210", strictly decreasing
 *
 * Throws on non-finite inputs.
 */
export function ordinalPatternCodeM3(a: number, b: number, c: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) {
    throw new Error(
      `ordinalPatternCodeM3 requires finite values (got ${a}, ${b}, ${c})`,
    );
  }
  // Compare with strict < so equal values fall back to the
  // earlier-index-wins (i.e. earlier index is "smaller") branch
  // -- the standard deterministic tie-break.
  // Build an indexed array, sort by (value asc, index asc).
  const idx: [number, number][] = [
    [a, 0],
    [b, 1],
    [c, 2],
  ];
  idx.sort((p, q) => {
    if (p[0] !== q[0]) return p[0] - q[0];
    return p[1] - q[1];
  });
  // The permutation pi = (idx[0][1], idx[1][1], idx[2][1]) lists
  // input positions in ascending-value order. Encode pi as a
  // factorial-base index in {0..5} matching the lex order above.
  const pi0 = idx[0]![1];
  const pi1 = idx[1]![1];
  // pi2 is determined by pi0, pi1.
  // Lex rank under canonical order:
  //   (0,1,2)->0  (0,2,1)->1  (1,0,2)->2  (1,2,0)->3
  //   (2,0,1)->4  (2,1,0)->5
  if (pi0 === 0 && pi1 === 1) return 0;
  if (pi0 === 0 && pi1 === 2) return 1;
  if (pi0 === 1 && pi1 === 0) return 2;
  if (pi0 === 1 && pi1 === 2) return 3;
  if (pi0 === 2 && pi1 === 0) return 4;
  return 5; // (2,1,0)
}

/**
 * Normalised Bandt-Pompe permutation entropy of a real-valued
 * series at embedding m=3, lag tau=1. Returns the entropy in
 * [0, 1] together with the per-pattern probability vector and
 * the argmax pattern. flat=true with entropyNorm=0 when the
 * series has fewer than m windows (n < m).
 */
export function permutationEntropyM3(values: number[]): {
  entropyNorm: number;
  patternShares: number[];
  peakPattern: number;
  peakShare: number;
  flat: boolean;
} {
  const n = values.length;
  const counts = new Array<number>(PE_PATTERN_COUNT).fill(0);
  if (n < PE_EMBEDDING_M) {
    return {
      entropyNorm: 0,
      patternShares: counts,
      peakPattern: -1,
      peakShare: 0,
      flat: true,
    };
  }
  const w = n - PE_EMBEDDING_M + 1;
  for (let i = 0; i < w; i += 1) {
    const code = ordinalPatternCodeM3(values[i]!, values[i + 1]!, values[i + 2]!);
    counts[code]! += 1;
  }
  let h = 0;
  let argmax = 0;
  let argmaxC = -1;
  const shares = new Array<number>(PE_PATTERN_COUNT).fill(0);
  for (let k = 0; k < PE_PATTERN_COUNT; k += 1) {
    const c = counts[k]!;
    if (c > argmaxC) {
      argmaxC = c;
      argmax = k;
    }
    if (c > 0) {
      const p = c / w;
      shares[k] = p;
      h -= p * Math.log(p);
    }
  }
  let entropyNorm = h / Math.log(PE_PATTERN_COUNT);
  if (entropyNorm > 1) entropyNorm = 1;
  if (entropyNorm < 0) entropyNorm = 0;
  return {
    entropyNorm,
    patternShares: shares,
    peakPattern: argmax,
    peakShare: argmaxC / w,
    flat: false,
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

export function buildDailyTokenPermutationEntropy(
  queue: QueueLine[],
  opts: DailyTokenPermutationEntropyOptions = {},
): DailyTokenPermutationEntropyReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < PE_EMBEDDING_M + 1) {
    throw new Error(
      `minTenureDays must be an integer >= ${PE_EMBEDDING_M + 1} (permutation entropy at embedding m=${PE_EMBEDDING_M} requires at least one sliding window) (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const maxEntropy = opts.maxEntropy ?? null;
  if (
    maxEntropy !== null &&
    (!Number.isFinite(maxEntropy) || maxEntropy < 0 || maxEntropy > 1)
  ) {
    throw new Error(
      `maxEntropy must be a finite number in [0, 1] when set (got ${opts.maxEntropy})`,
    );
  }
  const sort: DailyTokenPermutationEntropySort = opts.sort ?? 'entropy';
  const validSorts: DailyTokenPermutationEntropySort[] = [
    'entropy',
    'entropyDesc',
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
  let totalTokensSum = 0;
  const rows: DailyTokenPermutationEntropySourceRow[] = [];

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
    let mu = 0;
    for (const v of filled) mu += v;
    mu /= nTenure;
    let varSum = 0;
    for (const v of filled) {
      const d = v - mu;
      varSum += d * d;
    }
    const stddev = Math.sqrt(varSum / nTenure);
    const pe = permutationEntropyM3(filled);
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      nWindows: nTenure - PE_EMBEDDING_M + 1,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: mu,
      stddev,
      peakPattern: pe.peakPattern,
      peakShare: pe.peakShare,
      patternShares: pe.patternShares,
      entropyNorm: pe.entropyNorm,
      flat: pe.flat,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedAboveMaxEntropy = 0;
  let filtered = rows;
  if (maxEntropy !== null) {
    const next: DailyTokenPermutationEntropySourceRow[] = [];
    for (const r of rows) {
      if (r.flat) next.push(r);
      else if (r.entropyNorm <= maxEntropy) next.push(r);
      else droppedAboveMaxEntropy += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'entropyDesc':
        primary = b.entropyNorm - a.entropyNorm;
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
      case 'entropy':
      default:
        primary = a.entropyNorm - b.entropyNorm;
        break;
    }
    if (Number.isNaN(primary) || primary === 0) {
      return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    return primary;
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
    minTokens,
    minTenureDays,
    embeddingM: PE_EMBEDDING_M,
    patternCount: PE_PATTERN_COUNT,
    top,
    sort,
    maxEntropy,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinTenure,
    droppedAboveMaxEntropy,
    droppedTopSources,
    sources: kept,
  };
}
