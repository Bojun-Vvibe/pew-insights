/**
 * daily-token-katz-fd: per-source Katz Fractal Dimension
 * (Katz 1988, Comput. Biol. Med. 18(3):145-156) on the gap-filled
 * daily total_tokens series.
 *
 * SEVENTY-FIFTH cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (same
 * gap-fill convention as axes 67/68/69/70/71/72/73/74). Then treat
 * the gap-filled series as a planar curve {(i, x[i])} for
 * i = 0..N-1 with unit x-spacing and compute:
 *
 *   L = sum_{i=1..N-1} sqrt(1 + (x[i] - x[i-1])^2)
 *   d = max_{i=1..N-1} sqrt(i^2 + (x[i] - x[0])^2)
 *   n = L / a   where a = L / (N - 1) is the average step length
 *     => n = N - 1   (Katz's normalisation: re-express the curve
 *                    in units of its own average step length so the
 *                    dimension is dimensionless and comparable
 *                    across series of different absolute scales)
 *   KFD = log10(n) / (log10(n) + log10(d / L))
 *
 * Equivalently, after substituting `n = N - 1`:
 *
 *   KFD = log10(N - 1) / (log10(N - 1) + log10(d / L))
 *
 * KFD is in [1, 2] for any non-degenerate planar curve:
 *   KFD ~ 1.0 = near-straight curve (d ~ L; the curve is close to
 *               its own start-to-furthest chord).
 *   KFD ~ 1.3-1.5 = moderate roughness (d << L; total path is much
 *                   longer than the maximal chord).
 *   KFD -> 2 = heavily oscillating / space-filling.
 *
 * Headline question:
 * **"For each source, how does the TOTAL daily-token arc length
 *   compare with the maximal chord from the first day, in units
 *   of the average per-day step length?"**
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY NEW
 * PRIMITIVE NOT COVERED BY ANY SHIPPED DAILY-TOKEN AXIS 32..74:
 *
 *   - vs `daily-token-higuchi-fd` (axis 74): HFD is a MULTI-SCALE
 *     POWER-LAW EXPONENT — the negated OLS slope of log(L(k)) vs
 *     log(k) across stride k = 1..kMax. KFD is a SINGLE-SCALE
 *     CLOSED-FORM RATIO of total arc length to maximal chord, in
 *     units of average step length. They coincide only for ideal
 *     self-similar planar curves; on real bounded gap-filled token
 *     series they routinely disagree and rankings do not preserve.
 *     A long monotone ramp has HFD ~ 1.0 (constant L(k) under
 *     Higuchi normalisation, slope ~ 0, clamps to 1) AND KFD ~ 1.0
 *     (d ~ L for monotone curves), so they agree on the smooth end.
 *     A heavy-tailed shuffled series has HFD ~ 2.0 (power-law slope
 *     near 1) and KFD inflated above 1 (d / L collapses). The
 *     disagreement zone is the middle: a long-flat-then-spike
 *     series can have HFD near 1 (most strides see 0 increments,
 *     fit pulled toward smooth) but KFD strongly above 1 (the
 *     spike pumps L while leaving d ~ chord-from-start).
 *
 *   - vs `daily-token-hurst-rs` (axis 71) and `daily-token-dfa-
 *     alpha` (axis 72): R/S and DFA are VARIANCE-scaling estimators
 *     on cumulative deviations (DFA additionally detrends each
 *     window). KFD is a closed-form GEOMETRIC ratio on the raw
 *     series with no integration, no detrending, no scaling
 *     hierarchy at all. The integration-ladder argument that
 *     applies to HFD vs DFA applies a fortiori to KFD.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): SE summarises
 *     flatness of the global periodogram. KFD is a single
 *     time-domain geometric scalar with no frequency decomposition.
 *     Two series with identical periodograms (same multiset of
 *     |X[k]|^2) can have very different KFD because phase
 *     reordering changes L while preserving SE.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70): PE is
 *     ORDINAL on length-3 windows, monotone-invariant. KFD is
 *     METRIC and invariant only under positive multiplicative
 *     rescale of the value axis (NOT under additive shift, because
 *     d carries an absolute distance from x[0]). A linear ramp has
 *     PE = 0 AND KFD ~ 1.0; a noisy bounded oscillation can have
 *     PE near 1 and KFD substantially above 1.
 *
 *   - vs `daily-token-sample-entropy` (axis 73): SampEn is a
 *     SHORT-WINDOW SINGLE-SCALE conditional irregularity at one
 *     (m, r) on TEMPLATE recurrence. KFD is a SINGLE-SCALE
 *     GEOMETRIC ratio with no template matching at all. They
 *     measure orthogonal facets of complexity (template recurrence
 *     vs curve geometry).
 *
 *   - vs `daily-token-autocorrelation-lag1` / `lag7`
 *     (axes 67/68): ACF is a SECOND-MOMENT linear scalar at one
 *     fixed lag. KFD is a deterministic geometric ratio and is
 *     well-defined even when all finite-lag rho_k = 0.
 *
 *   - vs all permutation-invariant dispersion / shape axes 32..67
 *     (Gini, Atkinson, Theil, GE, Hill, MC, L-skew, ...): those
 *     are shuffle-invariant; KFD is shuffle-sensitive. The
 *     sorted-vs-shuffled witness ships in the test file: the same
 *     multiset sorted gives KFD near 1.0 (smooth) while shuffled
 *     gives KFD substantially above 1 (rough), with every
 *     multiset / dispersion / shape statistic bit-identical across
 *     the two arrangements.
 *
 * Caveats:
 *
 *   - All-zero gap-filled series (vanishingly rare given upstream
 *     `tt > 0` filter, but possible if a source's only positive
 *     days span a tenure of zero) yield L = 0 and d = 0; we drop
 *     these as `droppedZeroVariance` (mirrors axis-74).
 *   - Katz's KFD is bounded in [1, 2] in theory for planar curves
 *     with unit x-spacing. We clamp the reported `kfd` to [1, 2]
 *     for symmetry with axis-74's HFD reporting and surface the
 *     un-clamped `kfdRaw`, plus `clampedBelow1` / `clampedAbove2`
 *     counters. In practice with unit x-spacing and any non-zero
 *     y-variation, kfdRaw is mathematically >= 1 (because d <= L
 *     by triangle-inequality after substituting n = L/a, giving
 *     log(n)+log(d/L) <= log(n)), so `clampedBelow1` should never
 *     fire on real data; it is wired in defensively for IEEE-754
 *     rounding pathologies on tiny d.
 *   - KFD is NOT shift-invariant in its raw form (d depends on
 *     absolute position relative to x[0]), but IS scale-invariant:
 *     multiplying the series by any positive constant c rescales
 *     both L and d in the same way for the y-component but leaves
 *     the unit x-spacing unchanged, so the ratio d / L is not
 *     strictly invariant under value-axis rescaling. Empirically
 *     on bounded daily-token series, the unit-x-spacing convention
 *     yields kfdRaw values that ARE robust to multiplicative
 *     rescaling within ~1e-2; the test file ships a rescale-
 *     stability assertion at the 1e-2 tolerance.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * References:
 *   Katz, M. J., "Fractals and the analysis of waveforms",
 *     Computers in Biology and Medicine 18(3):145-156, 1988.
 *   Esteller, R., Vachtsevanos, G., Echauz, J., Litt, B., "A
 *     comparison of waveform fractal dimension algorithms", IEEE
 *     Trans. Circuits Syst. I 48(2):177-183, 2001.
 */
import type { QueueLine } from './types.js';

export type DailyTokenKatzFdSort =
  | 'absKfdDeviationDesc'
  | 'kfd'
  | 'kfdDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenKatzFdOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4 so the curve
   * has at least 3 segments and a chord that is not the trivial
   * one-step. Default 32 (matches axis-74).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenKatzFdSort;
  generatedAt?: string;
}

export interface DailyTokenKatzFdSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Katz fractal dimension clamped to [1, 2]. */
  kfd: number;
  /** Un-clamped Katz fractal dimension. */
  kfdRaw: number;
  /** Total Euclidean path length L. */
  pathLength: number;
  /** Maximal chord d from the first point. */
  maxChord: number;
  /** Index (0-based) at which the maximal chord occurs. */
  maxChordIndex: number;
  /** Average step length a = L / (N - 1). */
  avgStep: number;
  /** True if kfdRaw was clamped from below 1 to 1 (defensive only). */
  clampedBelow1: boolean;
  /** True if kfdRaw was clamped from above 2 to 2. */
  clampedAbove2: boolean;
}

export interface DailyTokenKatzFdReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenKatzFdSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteKfd: number;
  droppedTopSources: number;
  clampedBelow1: number;
  clampedAbove2: number;
  sources: DailyTokenKatzFdSourceRow[];
}

/**
 * Katz Fractal Dimension on a real-valued series treated as a
 * planar curve with unit x-spacing. Returns the un-clamped KFD,
 * total path length L, max chord d, the index at which d is
 * achieved, and the average step length a.
 *
 * Algorithm (Katz 1988, Esteller et al. 2001):
 *   1. L = sum_{i=1..N-1} sqrt(1 + (x[i] - x[i-1])^2)
 *   2. d = max_{i=1..N-1} sqrt(i^2 + (x[i] - x[0])^2)
 *   3. a = L / (N - 1); n = L / a = N - 1
 *   4. KFD = log10(n) / (log10(n) + log10(d / L))
 *
 * Throws when N < 2 or when both L and d collapse to zero
 * (degenerate constant series).
 */
export function katzFd(values: number[]): {
  kfd: number;
  kfdRaw: number;
  pathLength: number;
  maxChord: number;
  maxChordIndex: number;
  avgStep: number;
  clampedBelow1: boolean;
  clampedAbove2: boolean;
} {
  const N = values.length;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('katzFd requires finite values');
    }
  }
  if (N < 2) {
    throw new Error(`katzFd: series too short (n=${N}, need n >= 2)`);
  }
  const x0 = values[0]!;
  let L = 0;
  let d = 0;
  let dIdx = 0;
  for (let i = 1; i < N; i += 1) {
    const dy = values[i]! - values[i - 1]!;
    L += Math.sqrt(1 + dy * dy);
    const cy = values[i]! - x0;
    const c = Math.sqrt(i * i + cy * cy);
    if (c > d) {
      d = c;
      dIdx = i;
    }
  }
  if (!(L > 0) || !(d > 0)) {
    throw new Error('katzFd: degenerate curve (L or d collapsed to 0)');
  }
  const a = L / (N - 1);
  // n = L / a is mathematically (N - 1) — keep this form for
  // numerical stability and to match the closed-form ratio used in
  // the tests.
  const n = N - 1;
  const logN = Math.log10(n);
  const logRatio = Math.log10(d / L);
  const denom = logN + logRatio;
  if (!Number.isFinite(denom) || denom === 0) {
    throw new Error(
      'katzFd: log-ratio collapsed to non-finite or zero denominator',
    );
  }
  const kfdRaw = logN / denom;
  if (!Number.isFinite(kfdRaw)) {
    throw new Error(`katzFd: non-finite kfdRaw (${kfdRaw})`);
  }
  const clampedBelow1 = kfdRaw < 1;
  const clampedAbove2 = kfdRaw > 2;
  const kfd = Math.max(1, Math.min(2, kfdRaw));
  return {
    kfd,
    kfdRaw,
    pathLength: L,
    maxChord: d,
    maxChordIndex: dIdx,
    avgStep: a,
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

export function buildDailyTokenKatzFd(
  queue: QueueLine[],
  opts: DailyTokenKatzFdOptions = {},
): DailyTokenKatzFdReport {
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
  const sort: DailyTokenKatzFdSort = opts.sort ?? 'absKfdDeviationDesc';
  const validSorts: DailyTokenKatzFdSort[] = [
    'absKfdDeviationDesc',
    'kfd',
    'kfdDesc',
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
  let droppedNonFiniteKfd = 0;
  let clampedBelow1Count = 0;
  let clampedAbove2Count = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenKatzFdSourceRow[] = [];

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
      result = katzFd(filled);
    } catch {
      droppedNonFiniteKfd += 1;
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
      kfd: result.kfd,
      kfdRaw: result.kfdRaw,
      pathLength: result.pathLength,
      maxChord: result.maxChord,
      maxChordIndex: result.maxChordIndex,
      avgStep: result.avgStep,
      clampedBelow1: result.clampedBelow1,
      clampedAbove2: result.clampedAbove2,
    });
    totalTokensSum += accSrc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'kfd':
        primary = a.kfd - b.kfd;
        break;
      case 'kfdDesc':
        primary = b.kfd - a.kfd;
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
      case 'absKfdDeviationDesc':
      default:
        // Sources furthest from KFD = 1.0 (smooth baseline) first.
        // KFD is bounded below at 1 for non-degenerate planar
        // curves with unit x-spacing, so the natural reference is
        // the lower edge.
        primary = b.kfd - a.kfd;
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
    droppedNonFiniteKfd,
    droppedTopSources,
    clampedBelow1: clampedBelow1Count,
    clampedAbove2: clampedAbove2Count,
    sources: kept,
  };
}
