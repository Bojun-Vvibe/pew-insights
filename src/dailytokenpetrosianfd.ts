/**
 * daily-token-petrosian-fd: per-source Petrosian Fractal Dimension
 * (Petrosian 1995, Proc. 8th IEEE Symp. CBMS, pp. 212-217) on the
 * gap-filled daily total_tokens series.
 *
 * SEVENTY-SIXTH cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (same
 * gap-fill convention as axes 67/68/69/70/71/72/73/74/75). Then
 * compute:
 *
 *   1. dv[i] = x[i+1] - x[i] for i = 0..N-2 (length M = N - 1)
 *   2. Map dv[i] to a binary symbol s[i] in {+1, -1}: zero -> +1
 *      (Esteller-Vachtsevanos-Echauz-Litt 2001 convention; matches
 *      ZCR convention in this suite).
 *   3. Nd = number of adjacent sign flips in s[0..M-1].
 *   4. PFD = log10(M) / (log10(M) + log10(M / (M + 0.4 * Nd)))
 *
 * PFD is bounded in [1, 2]; reported `pfd` is clamped to that
 * range for symmetry with axes 74 (HFD) and 75 (KFD); un-clamped
 * `pfdRaw`, `clampedBelow1`, `clampedAbove2` counters are surfaced
 * for operators. Also reports `Nd` (raw flip count), `M` (effective
 * diff length), `zeroDiffs` (informational; how many dv[i] were
 * exactly zero), and `flipRate = Nd / (M - 1)` (length-normalised
 * raw flip density in [0, 1]).
 *
 * Reading PFD:
 *   - PFD ~ 1.0 = near-monotone trajectory in the gap-filled
 *     daily series (few sign flips in dv; values move mostly in
 *     one direction for long stretches).
 *   - PFD ~ 1.05-1.15 = moderate roughness; some sign flips but
 *     well below the Nyquist alternation rate.
 *   - PFD -> ~1.18 = near-maximum (Nyquist-like; nearly every diff
 *     flips sign).
 *
 * STRUCTURAL ORTHOGONALITY -- BINARY SIGN-FLIP SCALAR,
 * fundamentally distinct from every shipped daily-token axis 32..75:
 *
 *   - vs `daily-token-katz-fd` (axis 75): KFD is a METRIC quantity
 *     using actual numeric magnitudes through L (Euclidean path
 *     length) and d (max chord). PFD is purely BINARY after the
 *     sign mapping; magnitudes drop out completely. Multiply
 *     every value by 13 and Nd is bit-identical (test ships a
 *     positive-rescale invariance assertion); KFD typically moves
 *     under the same operation. Two series with identical
 *     sign-of-diff sequences and wildly different amplitudes share
 *     the same PFD but diverge sharply on KFD.
 *
 *   - vs `daily-token-higuchi-fd` (axis 74): HFD is a MULTI-SCALE
 *     OLS power-law exponent across stride k = 1..kMax, sensitive
 *     to magnitudes through L(k). PFD is single-scale, closed-form,
 *     binary post-sign-mapping. They probe different complexity
 *     facets (multi-scale magnitude scaling vs single-scale binary
 *     sign-flip density).
 *
 *   - vs `daily-token-hurst-rs` (axis 71) and `daily-token-dfa-
 *     alpha` (axis 72): R/S and DFA are VARIANCE-scaling estimators
 *     on cumulative deviations (DFA additionally detrends each
 *     window) — magnitude-sensitive. PFD has no cumulative profile
 *     and is binary post-sign-mapping.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): SE summarises
 *     flatness of the global periodogram (frequency-domain).
 *     PFD is a single time-domain binary scalar with no frequency
 *     decomposition. Two series with identical periodograms can
 *     have very different PFD because phase reordering changes
 *     the diff sign sequence.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70): PE is
 *     ORDINAL on length-3 windows (alphabet size 6); PFD is
 *     BINARY on the diff sign (alphabet size 2). PE counts
 *     ordinal pattern frequencies; PFD counts adjacent
 *     sign-flips in a single binary stream. A monotone ramp has
 *     PE = 0 AND PFD ~ 1.0; a noisy oscillation can have PE near
 *     1 and PFD substantially above 1 — but the disagreement
 *     zone is real: a series with many length-3 patterns but
 *     few sign flips (e.g. monotone-up-with-rare-pauses) has
 *     PE > 0 yet PFD ~ 1.
 *
 *   - vs `daily-token-sample-entropy` (axis 73): SampEn is a
 *     TEMPLATE-matching conditional irregularity at one (m, r);
 *     PFD has no template matching. They measure orthogonal
 *     facets (template recurrence vs binary sign-flip density).
 *
 *   - vs `daily-token-autocorrelation-lag1` / `lag7` (axes 67/68):
 *     ACF is a SECOND-MOMENT linear scalar at one fixed lag,
 *     magnitude-sensitive. PFD is a deterministic binary statistic
 *     and is well-defined even when all finite-lag rho_k = 0.
 *
 *   - vs all permutation-invariant dispersion / shape axes 32..67
 *     (Gini, Atkinson, Theil, GE, Hill, MC, L-skew, ...): those
 *     are shuffle-invariant; PFD is shuffle-sensitive. The
 *     sorted-vs-shuffled witness ships in the test file: the
 *     same multiset sorted gives PFD ~ 1.0 (one long run, Nd ~ 0)
 *     while shuffled inflates PFD substantially (many sign flips),
 *     with every multiset / dispersion / shape statistic
 *     bit-identical across the two arrangements.
 *
 * Caveats:
 *
 *   - All-zero gap-filled series (vanishingly rare given upstream
 *     `tt > 0` filter) yield Nd = 0 and M = N - 1; reported as
 *     `droppedZeroVariance` (mirrors axes 74/75).
 *   - PFD is bounded in [1, 2] in theory; reported `pfd` is
 *     clamped to that bracket. With unit step on integer i and
 *     non-degenerate sign sequence, pfdRaw is mathematically
 *     >= 1; `clampedBelow1` is wired in defensively for IEEE-754
 *     rounding pathologies on tiny Nd.
 *   - PFD is invariant under any strictly-positive multiplicative
 *     rescale of the value axis (because sign(c * dv) = sign(dv)
 *     for c > 0) AND under any strictly-monotone-increasing
 *     transform of the value axis (because sign-of-diff is
 *     preserved). It is NOT invariant under arbitrary additive
 *     shift of individual points (those can flip diff signs).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * References:
 *   Petrosian, A., "Kolmogorov complexity of finite sequences and
 *     recognition of different preictal EEG patterns", Proc. 8th
 *     IEEE Symp. CBMS, pp. 212-217, 1995.
 *   Esteller, R., Vachtsevanos, G., Echauz, J., Litt, B., "A
 *     comparison of waveform fractal dimension algorithms", IEEE
 *     Trans. Circuits Syst. I 48(2):177-183, 2001.
 */
import type { QueueLine } from './types.js';

export type DailyTokenPetrosianFdSort =
  | 'absPfdDeviationDesc'
  | 'pfd'
  | 'pfdDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenPetrosianFdOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4 so the diff
   * sign sequence has at least 3 entries (M >= 3 -> Nd >= 0
   * meaningful, log10(M) > 0). Default 32 (matches axes 74/75).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenPetrosianFdSort;
  generatedAt?: string;
}

export interface DailyTokenPetrosianFdSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Petrosian fractal dimension clamped to [1, 2]. */
  pfd: number;
  /** Un-clamped Petrosian fractal dimension. */
  pfdRaw: number;
  /** Number of adjacent sign flips in the diff sign sequence. */
  Nd: number;
  /** Effective length of the diff sign sequence (= N - 1). */
  M: number;
  /** Informational: how many dv[i] were exactly 0 (and mapped to +1). */
  zeroDiffs: number;
  /** Length-normalised raw flip density Nd / (M - 1) in [0, 1]. */
  flipRate: number;
  /** True if pfdRaw was clamped from below 1 to 1 (defensive only). */
  clampedBelow1: boolean;
  /** True if pfdRaw was clamped from above 2 to 2. */
  clampedAbove2: boolean;
}

export interface DailyTokenPetrosianFdReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenPetrosianFdSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFinitePfd: number;
  droppedTopSources: number;
  clampedBelow1: number;
  clampedAbove2: number;
  sources: DailyTokenPetrosianFdSourceRow[];
}

/**
 * Petrosian Fractal Dimension on a real-valued series with unit
 * x-spacing. Returns the un-clamped PFD, raw flip count Nd,
 * effective diff length M, zero-diff count, and flip rate.
 *
 * Algorithm (Petrosian 1995, Esteller et al. 2001):
 *   1. dv[i] = x[i+1] - x[i] for i = 0..N-2; M = N - 1.
 *   2. s[i] = +1 if dv[i] >= 0 else -1 (zero-rule: positive).
 *   3. Nd = sum_{i=0..M-2} 1[s[i] != s[i+1]].
 *   4. PFD = log10(M) / (log10(M) + log10(M / (M + 0.4 * Nd)))
 *
 * Throws when N < 3 (need M >= 2 for at least one possible flip
 * and log10(M) > 0) or when the log-ratio collapses to a
 * non-finite or zero denominator.
 */
export function petrosianFd(values: number[]): {
  pfd: number;
  pfdRaw: number;
  Nd: number;
  M: number;
  zeroDiffs: number;
  flipRate: number;
  clampedBelow1: boolean;
  clampedAbove2: boolean;
} {
  const N = values.length;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('petrosianFd requires finite values');
    }
  }
  if (N < 3) {
    throw new Error(`petrosianFd: series too short (n=${N}, need n >= 3)`);
  }
  const M = N - 1;
  const signs = new Array<number>(M);
  let zeroDiffs = 0;
  for (let i = 0; i < M; i += 1) {
    const d = values[i + 1]! - values[i]!;
    if (d === 0) zeroDiffs += 1;
    signs[i] = d >= 0 ? 1 : -1;
  }
  let Nd = 0;
  for (let i = 0; i < M - 1; i += 1) {
    if (signs[i] !== signs[i + 1]) Nd += 1;
  }
  const logM = Math.log10(M);
  if (!(logM > 0)) {
    throw new Error(`petrosianFd: log10(M) <= 0 (M=${M})`);
  }
  const inner = M / (M + 0.4 * Nd);
  const logRatio = Math.log10(inner);
  const denom = logM + logRatio;
  if (!Number.isFinite(denom) || denom === 0) {
    throw new Error(
      'petrosianFd: log-ratio collapsed to non-finite or zero denominator',
    );
  }
  const pfdRaw = logM / denom;
  if (!Number.isFinite(pfdRaw)) {
    throw new Error(`petrosianFd: non-finite pfdRaw (${pfdRaw})`);
  }
  const clampedBelow1 = pfdRaw < 1;
  const clampedAbove2 = pfdRaw > 2;
  const pfd = Math.max(1, Math.min(2, pfdRaw));
  const flipRate = M >= 2 ? Nd / (M - 1) : 0;
  return {
    pfd,
    pfdRaw,
    Nd,
    M,
    zeroDiffs,
    flipRate,
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

export function buildDailyTokenPetrosianFd(
  queue: QueueLine[],
  opts: DailyTokenPetrosianFdOptions = {},
): DailyTokenPetrosianFdReport {
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
  const sort: DailyTokenPetrosianFdSort = opts.sort ?? 'absPfdDeviationDesc';
  const validSorts: DailyTokenPetrosianFdSort[] = [
    'absPfdDeviationDesc',
    'pfd',
    'pfdDesc',
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
  let droppedNonFinitePfd = 0;
  let clampedBelow1Count = 0;
  let clampedAbove2Count = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenPetrosianFdSourceRow[] = [];

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
      result = petrosianFd(filled);
    } catch {
      droppedNonFinitePfd += 1;
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
      pfd: result.pfd,
      pfdRaw: result.pfdRaw,
      Nd: result.Nd,
      M: result.M,
      zeroDiffs: result.zeroDiffs,
      flipRate: result.flipRate,
      clampedBelow1: result.clampedBelow1,
      clampedAbove2: result.clampedAbove2,
    });
    totalTokensSum += accSrc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'pfd':
        primary = a.pfd - b.pfd;
        break;
      case 'pfdDesc':
        primary = b.pfd - a.pfd;
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
      case 'absPfdDeviationDesc':
      default:
        // PFD is bounded below at 1 for non-degenerate sequences;
        // sort by distance from 1 (== pfd desc).
        primary = b.pfd - a.pfd;
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
    droppedNonFinitePfd,
    droppedTopSources,
    clampedBelow1: clampedBelow1Count,
    clampedAbove2: clampedAbove2Count,
    sources: kept,
  };
}
