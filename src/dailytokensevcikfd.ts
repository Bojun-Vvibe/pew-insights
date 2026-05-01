/**
 * daily-token-sevcik-fd: per-source Sevcik 1998 Fractal Dimension
 * (Sevcik, C., "A procedure to estimate the fractal dimension of
 * waveforms", Complexity International 5, 1998) on the gap-filled
 * daily total_tokens series.
 *
 * SEVENTY-SEVENTH cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (same
 * gap-fill convention as axes 67/68/69/70/71/72/73/74/75/76).
 *
 * The Sevcik (1998) procedure:
 *
 *   1. DOUBLE-NORMALIZE the waveform onto the unit square:
 *        x*[i] = i / (N - 1)               (uniform unit spacing)
 *        y*[i] = (y[i] - ymin) / (ymax - ymin)
 *
 *   2. Compute the total Euclidean path length on the normalized
 *      waveform:
 *        L = sum_{i=1..N-1} sqrt((x*[i] - x*[i-1])^2 +
 *                                (y*[i] - y*[i-1])^2)
 *           = sum_{i=1..N-1} sqrt((1/(N-1))^2 + (dy*[i])^2)
 *
 *   3. Sevcik fractal dimension:
 *        SFD = 1 + ln(L) / ln(2 * (N - 1))
 *
 * SFD is bounded in [1, 2] for any non-degenerate waveform; reported
 * `sfd` is clamped to that range for symmetry with axes 74/75/76.
 * Un-clamped `sfdRaw`, `clampedBelow1`, `clampedAbove2` counters are
 * surfaced for operators. Also reports `pathLength` (L on the
 * normalized waveform), `N` (gap-filled tenure length), `yRange`
 * (ymax - ymin on the raw series; informational), and `dxStep`
 * (1 / (N - 1); informational).
 *
 * Reading SFD:
 *   - SFD ~ 1.0  = near-straight on the unit square (tiny vertical
 *                  excursions relative to horizontal extent; L ~ 1).
 *   - SFD ~ 1.3  = moderately rough waveform (L ~ a few units).
 *   - SFD -> 2   = highly rough / space-filling on the unit square
 *                  (L approaches 2*(N-1); upper theoretical bound
 *                  for unit-step Nyquist alternation between 0 and
 *                  1, where each segment has horizontal step
 *                  1/(N-1) and vertical step 1, so segment length
 *                  ~ 1, summed N-1 times yields L ~ N-1; with the
 *                  ln(2*(N-1)) denominator, SFD -> log(N-1) /
 *                  log(2*(N-1)) -> 1 from below as N grows large
 *                  — actually the analytic upper bound is SFD < 2
 *                  achieved only in the limit of infinite vertical
 *                  excursions per step, which is impossible after
 *                  range-normalization).
 *
 * STRUCTURAL ORTHOGONALITY -- SINGLE-SCALE CLOSED-FORM RATIO ON
 * THE DOUBLE-NORMALIZED WAVEFORM, fundamentally distinct from every
 * shipped daily-token axis 32..76:
 *
 *   - vs `daily-token-petrosian-fd` (axis 76): PFD is purely
 *     BINARY post-sign-mapping; magnitudes drop out completely
 *     (multiply values by 13 -> Nd unchanged -> PFD unchanged).
 *     SFD operates on the range-normalized magnitudes through
 *     `dy*[i] = dy[i] / (ymax - ymin)`. Two series with identical
 *     sign-of-diff sequences but different magnitude profiles
 *     (e.g. small wiggles vs large wiggles relative to range)
 *     share the same PFD but typically diverge on SFD because
 *     the dy*[i] magnitudes differ. Conversely, a positive
 *     affine rescale `y' = a*y + b` with a > 0 leaves SFD
 *     invariant (range-normalization absorbs both a and b),
 *     matching PFD's invariance under positive rescale — but
 *     SFD is sensitive to NON-affine monotone transforms (e.g.
 *     y' = sqrt(y)) that PFD ignores entirely.
 *
 *   - vs `daily-token-katz-fd` (axis 75): KFD = log10(N-1) /
 *     (log10(N-1) + log10(d/L_katz)) where L_katz is path length
 *     on the RAW series (no normalization) and d is the maximal
 *     RAW chord from the first day. KFD is dimensionally
 *     inconsistent in the original Katz formulation (mixes unit
 *     x-spacing with raw-magnitude y); SFD fixes the dimensional
 *     issue via double normalization. They use different
 *     denominator bases (log10(N-1) vs ln(2*(N-1))) and KFD's
 *     ratio uses the maximal chord d as a normalizer while SFD's
 *     ratio uses 2*(N-1) (the maximum possible L on the unit
 *     square). For positive affine rescales of y both are
 *     invariant, but they diverge sharply on series where the
 *     maximum chord d is far from the typical step magnitude
 *     (e.g. a series with one extreme outlier inflates d and
 *     pulls KFD down via the d/L ratio, while SFD is bounded
 *     by the range-normalized step distribution and is less
 *     sensitive to a single outlier's effect on the denominator).
 *
 *   - vs `daily-token-higuchi-fd` (axis 74): HFD is a multi-scale
 *     OLS power-law exponent across stride k = 1..kMax. SFD is
 *     single-scale, closed-form, with a hard-coded denominator
 *     `2*(N-1)`. They probe different complexity facets
 *     (multi-scale magnitude scaling vs single-scale double-
 *     normalized geometric ratio).
 *
 *   - vs `daily-token-hurst-rs` (axis 71) and `daily-token-dfa-
 *     alpha` (axis 72): R/S and DFA are VARIANCE-scaling
 *     estimators on cumulative deviations (DFA additionally
 *     detrends each window). SFD has no cumulative profile and
 *     no multi-scale fit.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): SE summarises
 *     flatness of the global periodogram (frequency-domain).
 *     SFD is a single time-domain geometric scalar with no
 *     frequency decomposition.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70) and `daily-
 *     token-sample-entropy` (axis 73): both are pattern /
 *     template statistics; SFD is a pure path-length geometric
 *     ratio with no embedding window or template matching.
 *
 *   - vs `daily-token-autocorrelation-lag1` / `lag7` (axes 67/68):
 *     ACF is a SECOND-MOMENT linear scalar at one fixed lag;
 *     SFD is a path-length ratio with no second-moment
 *     interpretation.
 *
 *   - vs all permutation-invariant dispersion / shape axes 32..67
 *     (Gini, Atkinson, Theil, GE, Hill, MC, L-skew, ...): those
 *     are shuffle-invariant; SFD is shuffle-sensitive (a sorted
 *     monotone sequence has L ~ sqrt(1 + 1) ~ 1.41 in the unit
 *     square so SFD is small, while a shuffled noisy sequence
 *     has L >> 1 and SFD substantially larger).
 *
 * Caveats:
 *
 *   - All-zero gap-filled series (vanishingly rare given upstream
 *     `tt > 0` filter) yield ymax = ymin and the y-normalization
 *     is degenerate; reported as `droppedZeroVariance` (mirrors
 *     axes 74/75/76).
 *   - SFD is defined in [1, 2] in theory; reported `sfd` is
 *     clamped to that bracket. With unit step on integer i and
 *     non-degenerate y-range, sfdRaw >= 1 mathematically;
 *     `clampedBelow1` is wired in defensively for IEEE-754
 *     rounding pathologies on tiny L.
 *   - SFD is invariant under any strictly-positive AFFINE
 *     transform of the y axis: y' = a*y + b with a > 0 leaves
 *     SFD unchanged because the range-normalization absorbs
 *     both a (cancels in dy/(ymax - ymin)) and b (cancels in
 *     the diff). It is NOT invariant under non-affine monotone
 *     transforms (e.g. y' = sqrt(y) reshapes the dy*[i]
 *     distribution and changes L).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * References:
 *   Sevcik, C., "A procedure to estimate the fractal dimension of
 *     waveforms", Complexity International 5, 1998 (also
 *     arXiv:1003.5266).
 */
import type { QueueLine } from './types.js';

export type DailyTokenSevcikFdSort =
  | 'absSfdDeviationDesc'
  | 'sfd'
  | 'sfdDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSevcikFdOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4 so the path
   * length sum has at least 3 segments and ln(2*(N-1)) > 0.
   * Default 32 (matches axes 74/75/76).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSevcikFdSort;
  generatedAt?: string;
}

export interface DailyTokenSevcikFdSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Sevcik fractal dimension clamped to [1, 2]. */
  sfd: number;
  /** Un-clamped Sevcik fractal dimension. */
  sfdRaw: number;
  /** Path length L on the double-normalized waveform. */
  pathLength: number;
  /** Range of the raw series (ymax - ymin); informational. */
  yRange: number;
  /** Horizontal step on the unit square (= 1 / (N - 1)); informational. */
  dxStep: number;
  /** True if sfdRaw was clamped from below 1 to 1 (defensive only). */
  clampedBelow1: boolean;
  /** True if sfdRaw was clamped from above 2 to 2. */
  clampedAbove2: boolean;
}

export interface DailyTokenSevcikFdReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSevcikFdSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteSfd: number;
  droppedTopSources: number;
  clampedBelow1: number;
  clampedAbove2: number;
  sources: DailyTokenSevcikFdSourceRow[];
}

/**
 * Sevcik 1998 Fractal Dimension on a real-valued series with unit
 * x-spacing. Returns the un-clamped SFD, normalized path length L,
 * raw y-range, and unit-square dx step.
 *
 * Algorithm (Sevcik 1998):
 *   1. Range-normalize y to [0, 1]: y*[i] = (y[i] - ymin) / (ymax - ymin).
 *   2. Map x to [0, 1] uniformly: x*[i] = i / (N - 1); dx = 1 / (N - 1).
 *   3. L = sum_{i=1..N-1} sqrt(dx^2 + (y*[i] - y*[i-1])^2).
 *   4. SFD = 1 + ln(L) / ln(2 * (N - 1)).
 *
 * Throws when N < 3 (need at least 2 segments and ln(2*(N-1)) > 0;
 * with N=3, 2*(N-1) = 4 and ln(4) > 0), when y is constant
 * (degenerate normalization), or when L collapses to a non-finite
 * or non-positive value.
 */
export function sevcikFd(values: number[]): {
  sfd: number;
  sfdRaw: number;
  pathLength: number;
  yRange: number;
  dxStep: number;
  clampedBelow1: boolean;
  clampedAbove2: boolean;
} {
  const N = values.length;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('sevcikFd requires finite values');
    }
  }
  if (N < 3) {
    throw new Error(`sevcikFd: series too short (n=${N}, need n >= 3)`);
  }
  let ymin = values[0]!;
  let ymax = values[0]!;
  for (let i = 1; i < N; i += 1) {
    const v = values[i]!;
    if (v < ymin) ymin = v;
    if (v > ymax) ymax = v;
  }
  const yRange = ymax - ymin;
  if (!(yRange > 0)) {
    throw new Error(`sevcikFd: zero y-range (ymin = ymax = ${ymin})`);
  }
  const dxStep = 1 / (N - 1);
  const dxSq = dxStep * dxStep;
  let L = 0;
  for (let i = 1; i < N; i += 1) {
    const dyNorm = (values[i]! - values[i - 1]!) / yRange;
    L += Math.sqrt(dxSq + dyNorm * dyNorm);
  }
  if (!Number.isFinite(L) || !(L > 0)) {
    throw new Error(`sevcikFd: non-positive or non-finite L (${L})`);
  }
  const denom = Math.log(2 * (N - 1));
  if (!(denom > 0)) {
    throw new Error(`sevcikFd: ln(2*(N-1)) <= 0 (N=${N})`);
  }
  const sfdRaw = 1 + Math.log(L) / denom;
  if (!Number.isFinite(sfdRaw)) {
    throw new Error(`sevcikFd: non-finite sfdRaw (${sfdRaw})`);
  }
  const clampedBelow1 = sfdRaw < 1;
  const clampedAbove2 = sfdRaw > 2;
  const sfd = Math.max(1, Math.min(2, sfdRaw));
  return {
    sfd,
    sfdRaw,
    pathLength: L,
    yRange,
    dxStep,
    clampedBelow1,
    clampedAbove2,
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

export function buildDailyTokenSevcikFd(
  queue: QueueLine[],
  opts: DailyTokenSevcikFdOptions = {},
): DailyTokenSevcikFdReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 4) {
    throw new Error(
      `minTenureDays must be an integer >= 4 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenSevcikFdSort = opts.sort ?? 'absSfdDeviationDesc';
  const validSorts: DailyTokenSevcikFdSort[] = [
    'absSfdDeviationDesc',
    'sfd',
    'sfdDesc',
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
  let droppedNonFiniteSfd = 0;
  let clampedBelow1Count = 0;
  let clampedAbove2Count = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenSevcikFdSourceRow[] = [];

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
      result = sevcikFd(filled);
    } catch {
      droppedNonFiniteSfd += 1;
      continue;
    }
    if (result.clampedBelow1) clampedBelow1Count += 1;
    if (result.clampedAbove2) clampedAbove2Count += 1;
    rows.push({
      source: src,
      totalTokens: accSrc.totalTokens,
      nActiveDays: accSrc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: accSrc.firstDay,
      lastActiveDay: accSrc.lastDay,
      sfd: result.sfd,
      sfdRaw: result.sfdRaw,
      pathLength: result.pathLength,
      yRange: result.yRange,
      dxStep: result.dxStep,
      clampedBelow1: result.clampedBelow1,
      clampedAbove2: result.clampedAbove2,
    });
    totalTokensSum += accSrc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'sfd':
        primary = a.sfd - b.sfd;
        break;
      case 'sfdDesc':
        primary = b.sfd - a.sfd;
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
      case 'absSfdDeviationDesc':
      default:
        // SFD is bounded below at 1 for non-degenerate sequences;
        // sort by distance from 1 (== sfd desc).
        primary = b.sfd - a.sfd;
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
    droppedNonFiniteSfd,
    droppedTopSources,
    clampedBelow1: clampedBelow1Count,
    clampedAbove2: clampedAbove2Count,
    sources: kept,
  };
}
