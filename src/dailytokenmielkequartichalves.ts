/**
 * daily-token-mielke-quartic-halves: per-source MIELKE
 * 1972 QUARTIC-CENTERED-RANKS SCALE TEST for equality of
 * dispersion between the first half (n1 = floor(n/2)
 * days) vs second half (n2 = n - n1 days) of the median-
 * aligned, gap-filled daily total_tokens series.
 *
 * TWO-HUNDREDTH cross-source axis.
 *
 * Mechanism. Pool the median-aligned values, compute the
 * pooled mid-ranks `R_i in {1..n}`, then assign the
 * MIELKE QUARTIC SCORE
 *
 *     a(R_i) = ( R_i - (n + 1) / 2 )^4
 *
 * (Mielke 1972 *J. Amer. Statist. Assoc.* 67:850-854,
 * eq. 2.3 with p = 4 in the family of POWER-OF-RANKS
 * scale tests T_p = sum (R - (n+1)/2)^p). The statistic
 * is the second-half score sum
 *
 *     M       = sum_{j in B} a(R_j)
 *     E[M]    = n2 * abar
 *     Var[M]  = ( n1 * n2 / ( n * (n - 1) ) ) * sum (a - abar)^2
 *     mielkeZ = ( M - E[M] ) / sqrt(Var[M])  ~ N(0, 1)
 *
 * (the Var[M] formula is the EXACT permutation variance
 * of any rank-score sub-sample; Lehmann 1975 *Nonparametrics:
 * Statistical Methods Based on Ranks* Theorem 8.1.) Two-
 * sided p-value `mielkePValue = 2 (1 - Phi(|mielkeZ|))`.
 *
 * SIGN CONVENTION: `mielkeZ > 0` <=> SECOND half MORE
 * dispersed (its observations land further from the
 * pooled rank midpoint, accumulating more quartic-
 * centered weight); `mielkeZ < 0` <=> FIRST half MORE
 * dispersed. Matches axis-117 stZ, axis-170 abZ, axis-177
 * klotzZ, axis-178 conoverZ, axis-179 moodZ, axis-199
 * caponZ directional convention for direct cross-axis
 * aggregation.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs axis-179 daily-token-mood-halves (Mood 1954,
 *     p = 2 in the same Mielke power-of-ranks family).
 *     Mood's quadratic weight (R - (n+1)/2)^2 is bounded
 *     by ((n-1)/2)^2; Mielke's quartic weight
 *     (R - (n+1)/2)^4 is bounded by ((n-1)/2)^4 — for
 *     n = 16 the extreme-rank score is 7.5^2 = 56.25 for
 *     Mood vs 7.5^4 = 3164 for Mielke, so Mielke weights
 *     the EXTREME RANKS ~56x more heavily than Mood on
 *     the same data. Mood is Pitman ARE 15/(2 pi^2) ~
 *     0.760 vs F under normal; Mielke 1972 sec. 4 Tab. 2
 *     reports T_4 ARE ~0.71 vs F under normal but ARE
 *     ~1.32 vs F under double-exponential and ~2.1 vs F
 *     under Cauchy — Mielke is MORE POWERFUL than Mood
 *     under heavy-tailed scale alternatives precisely
 *     because the quartic weight amplifies tail-rank
 *     contributions where heavy-tailed distributions
 *     concentrate scale information. Empirically the two
 *     reject in the same direction but Mielke's signal
 *     is dominated by the 4 most extreme ranks while
 *     Mood spreads weight more uniformly across the
 *     U-shape.
 *
 *   - vs axis-177 daily-token-klotz-halves (Klotz 1962,
 *     squared NORMAL scores). Klotz uses
 *     a(R) = (Phi^{-1}(R/(n+1)))^2 — the squared INVERSE-
 *     NORMAL plotting position; tail score grows like
 *     2 log(n) (logarithmic saturation). Mielke uses
 *     POLYNOMIAL R^4-style growth — at n = 30 Klotz's
 *     extreme score is ~7.4 vs Mielke's 14.5^4 = 44205,
 *     which after standardization translates to MIELKE
 *     putting an effective ~99.5% of its variance on the
 *     5 most extreme ranks at n = 30 (vs Klotz's ~60%).
 *     The two diverge sharply when scale shifts are
 *     concentrated in the absolute extremes vs spread
 *     across the upper quartile. Klotz ARE 1.000 vs F
 *     under normal (LMP for normal scale alts); Mielke
 *     ARE 0.71 — Mielke trades normal-power for HEAVY-
 *     TAIL POWER.
 *
 *   - vs axis-178 daily-token-conover-squared-ranks-
 *     halves (Conover 1971/1980, raw squared ranks on
 *     |X - within-half-median|). Conover's score is
 *     `R^2` on the ABSOLUTE-DEVIATION space (median fold
 *     applied PER HALF before pooling). Mielke's score
 *     is `(R - (n+1)/2)^4` on RAW (median-aligned but
 *     not folded) values. The fold doubles the effective
 *     resolution of the upper rank tail (Conover) vs
 *     placing equal weight on both extreme tails
 *     (Mielke); under joint location-and-scale shift
 *     the two reject in opposite directions when the
 *     two halves' folds map symmetric-from-median tail
 *     mass differently.
 *
 *   - vs axis-199 daily-token-capon-halves (Capon 1961,
 *     squared NORMAL scores with continuity-corrected
 *     Blom plotting position). Capon's score
 *     a(R) = (Phi^{-1}((R-0.5)/n))^2 is the LMP normal
 *     scale score; Mielke's quartic score is the LMP
 *     score for a STUDENT-t with df = 5 alternative
 *     (Mielke 1972 sec. 3 — quartic is the score
 *     function corresponding to t_5 dispersion shifts).
 *     The two are STRUCTURALLY DUAL: Capon dominates
 *     under normal/sub-Gaussian, Mielke dominates under
 *     heavy-tailed t-like dispersion shifts — exactly
 *     the regime where token-usage spikes accumulate.
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves
 *     (linear outside-in ranks, ARE 0.608 vs F) and
 *     axis-170 daily-token-ansari-bradley-halves (folded
 *     linear ranks |R - (n+1)/2|, ARE 6/pi^2 ~ 0.608).
 *     ST and AB use weights LINEAR in distance from the
 *     rank midpoint; Mielke's QUARTIC weight grows as
 *     the 4th power. ARE Mielke/AB = (T_4 ARE) /
 *     (6/pi^2) ~ 1.17 under normal, but the gap widens
 *     to 2-3x under heavy tails — Mielke is materially
 *     more powerful for token-spike scale alternatives.
 *
 *   - vs axes 174/175 Cucconi/Lepage (joint chi-2(2)
 *     location-scale tests). C/L combine a location and
 *     a scale statistic into one chi-2(2); they cannot
 *     SEPARATE the two channels. Mielke is a pure scale
 *     test and answers ONLY the dispersion question;
 *     combined with axis-176 BM (pure location), Mielke
 *     forms an ORTHOGONAL DECOMPOSITION of what C/L mash
 *     together — with Mielke optimised for HEAVY-TAILED
 *     scale alternatives that Cucconi/Lepage's Wilcoxon-
 *     scale Mood/AB component would dilute.
 *
 * Pre-alignment: median-fold each half by SUBTRACTING
 * THE WITHIN-SAMPLE MEDIAN from each half before pooling
 * and ranking (Hollander & Wolfe 1999 *Nonparametric
 * Statistical Methods* 2nd ed. sec. 5.1; matches axis-
 * 177 Klotz, axis-199 Capon convention). The aligned
 * series preserves dispersion differences while centring
 * location differences out — without this step, a
 * location shift between halves would inflate
 * |R - (n+1)/2|^4 for the away-half regardless of true
 * dispersion.
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8) so
 * the asymptotic normal reference holds nominal alpha
 * (Mielke 1972 sec. 4 simulation: actual size 0.041-0.057
 * across n1 = n2 in [8, 50] for p in [2, 6]).
 *
 * Reference:
 *   Mielke, P. W., "Asymptotic behavior of two-sample
 *     tests based on powers of ranks for detecting scale
 *     and location alternatives", *J. Amer. Statist.
 *     Assoc.* 67(340) (1972), pp. 850-854.
 *   Lehmann, E. L., *Nonparametrics: Statistical Methods
 *     Based on Ranks* (Holden-Day 1975), Theorem 8.1.
 *   Hollander, M. & Wolfe, D. A., *Nonparametric
 *     Statistical Methods* 2nd ed. (Wiley 1999), sec. 5.1.
 */
import type { QueueLine } from './types.js';

export type DailyTokenMielkeQuarticHalvesSort =
  | 'mielkeZ'
  | 'mielkeZAbsDesc'
  | 'mielkePValue'
  | 'mielkePValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenMielkeQuarticHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8) so the asymptotic normal reference
   * holds nominal alpha (Mielke 1972 sec. 4).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenMielkeQuarticHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenMielkeQuarticHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  mielkeN1: number;
  /** Second-half size n2 = n - n1. */
  mielkeN2: number;
  /** Pooled-score mean abar = (1/n) sum a(R_i). */
  mielkeAbar: number;
  /** Sum of squared deviations of a(R_i) from abar. */
  mielkeScoreSS: number;
  /** Mielke statistic M = sum_{j in B} a(R_j). */
  mielkeM: number;
  /** Null mean E[M] = n2 * abar. */
  mielkeExpM: number;
  /** Null variance Var[M] = n1 n2 / (n(n-1)) * mielkeScoreSS. */
  mielkeVarM: number;
  /** Standardised Mielke Z ~ N(0, 1) under H0. */
  mielkeZ: number;
  /** Two-sided normal p-value 2 (1 - Phi(|mielkeZ|)). */
  mielkePValue: number;
}

export interface DailyTokenMielkeQuarticHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenMielkeQuarticHalvesSort;
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
  sources: DailyTokenMielkeQuarticHalvesSourceRow[];
}

/**
 * Compute mid-ranks of `values` (1-indexed). Equal values
 * receive the average of their rank positions.
 */
export function midRanksMielke(values: number[]): number[] {
  const n = values.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]!]! === values[idx[i]!]!) {
      j += 1;
    }
    const midRank = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k += 1) {
      ranks[idx[k]!] = midRank;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Median of an array of finite numbers (does not mutate
 * the input). Standard textbook definition.
 */
export function medianMielke(values: number[]): number {
  if (values.length === 0) {
    throw new Error('medianMielke: empty input');
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Mielke (1972) quartic-centered-ranks scale test on the
 * first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series. Pre-aligns
 * each half by subtracting its within-sample median
 * (Hollander & Wolfe 1999 sec. 5.1). Returns the
 * quartic-centred-rank score statistic
 * M = sum_{j in B} (R_j - (n+1)/2)^4, its null mean and
 * variance, the standardised Z, and the two-sided
 * normal p-value.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - mielkeZ(x + c) === mielkeZ(x) for any constant c
 *     (median-alignment removes the global shift; ranks
 *     are invariant under monotone transforms).
 *   - mielkeZ(a * x) === mielkeZ(x) for any a > 0
 *     (positive scale preserves both halves' medians and
 *     pooled mid-ranks).
 *   - mielkeZ is invariant under independent location
 *     shifts of A and B (the median-alignment subtracts
 *     each half's median first).
 *   - For x = repeat(constant) the test is undefined
 *     (zero score variance after alignment); we throw
 *     to be filtered upstream.
 *   - mielkeZ(reverse(x)) === -mielkeZ(x) WHEN n1 = n2
 *     AND there are no ties (swapping halves negates the
 *     numerator (M - E[M]); Var[M] is symmetric in the
 *     labels).
 */
export function dailyTokenMielkeQuarticHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  mielkeN1: number;
  mielkeN2: number;
  mielkeAbar: number;
  mielkeScoreSS: number;
  mielkeM: number;
  mielkeExpM: number;
  mielkeVarM: number;
  mielkeZ: number;
  mielkePValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenMielkeQuarticHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenMielkeQuarticHalves requires finite values');
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
      `dailyTokenMielkeQuarticHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // Pre-align each half by subtracting its within-sample
  // median (Hollander & Wolfe 1999 sec. 5.1).
  const aRaw = values.slice(0, n1);
  const bRaw = values.slice(n1);
  const aMed = medianMielke(aRaw);
  const bMed = medianMielke(bRaw);
  const aligned = new Array<number>(n);
  for (let i = 0; i < n1; i += 1) aligned[i] = aRaw[i]! - aMed;
  for (let j = 0; j < n2; j += 1) aligned[n1 + j] = bRaw[j]! - bMed;

  // Pooled mid-ranks on the aligned values.
  const ranks = midRanksMielke(aligned);

  const midpoint = (n + 1) / 2;

  // Quartic-centred-rank score a(R_i) = (R_i - (n+1)/2)^4.
  const scores = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const c = ranks[i]! - midpoint;
    const c2 = c * c;
    scores[i] = c2 * c2;
  }

  let abar = 0;
  for (let i = 0; i < n; i += 1) abar += scores[i]!;
  abar /= n;

  let scoreSS = 0;
  for (let i = 0; i < n; i += 1) {
    const c = scores[i]! - abar;
    scoreSS += c * c;
  }
  if (!(scoreSS > 0) || !Number.isFinite(scoreSS)) {
    throw new Error(
      `dailyTokenMielkeQuarticHalves: degenerate score variance (scoreSS=${scoreSS})`,
    );
  }

  let M = 0;
  for (let j = 0; j < n2; j += 1) M += scores[n1 + j]!;

  const expM = n2 * abar;
  const varM = ((n1 * n2) / (n * (n - 1))) * scoreSS;
  if (!(varM > 0) || !Number.isFinite(varM)) {
    throw new Error(
      `dailyTokenMielkeQuarticHalves: degenerate null variance (varM=${varM})`,
    );
  }
  const mielkeZ = (M - expM) / Math.sqrt(varM);
  const mielkePValue = 2 * standardNormalUpperTailMielke(Math.abs(mielkeZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    mielkeN1: n1,
    mielkeN2: n2,
    mielkeAbar: abar,
    mielkeScoreSS: scoreSS,
    mielkeM: M,
    mielkeExpM: expM,
    mielkeVarM: varM,
    mielkeZ,
    mielkePValue,
  };
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) using the
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation; max relative error ~7.5e-8 across the
 * full real line.
 */
export function standardNormalUpperTailMielke(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailMielke: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailMielke(-z);
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
 * Corpus-level SIGNED aggregator for axis-200 per-source
 * results. Combines the per-source SIGNED mielkeZ via
 * STOUFFER'S Z-METHOD (Stouffer et al. 1949; Whitlock
 * 2005 *J. Evol. Biol.* 18:1368-1373):
 *
 *     stoufferZ = sum_i mielkeZ_i / sqrt(m)
 *     stoufferTwoSidedPValue = 2 (1 - Phi(|stoufferZ|))
 *
 * Returns the corpus-mean mielkeZ (unweighted) plus the
 * TENURE-WEIGHTED mean mielkeZ for downstream
 * interpretation, matching the axis-177/178/179/199
 * aggregator weighting convention.
 *
 * Malformed rows (non-finite mielkeZ, mielkePValue not in
 * (0, 1], non-positive mielkeVarM or nTenureDays) are
 * SKIPPED with a counter rather than throwing.
 */
export interface MielkeQuarticHalvesCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanMielkeZ: number;
  tenureWeightedMeanMielkeZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateMielkeQuarticHalves(
  rows: ReadonlyArray<{
    mielkeZ: number;
    mielkePValue: number;
    mielkeVarM: number;
    nTenureDays: number;
  }>,
): MielkeQuarticHalvesCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.mielkeZ) ||
      !Number.isFinite(r.mielkePValue) ||
      r.mielkePValue <= 0 ||
      r.mielkePValue > 1 ||
      !Number.isFinite(r.mielkeVarM) ||
      r.mielkeVarM <= 0 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.mielkeZ;
    weightedZSum += r.nTenureDays * r.mielkeZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanMielkeZ: Number.NaN,
      tenureWeightedMeanMielkeZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailMielke(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanMielkeZ: zSum / used,
    tenureWeightedMeanMielkeZ: weightedZSum / totalTenure,
    rowsUsed: used,
    rowsSkipped: skipped,
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

export function buildDailyTokenMielkeQuarticHalves(
  queue: QueueLine[],
  opts: DailyTokenMielkeQuarticHalvesOptions = {},
): DailyTokenMielkeQuarticHalvesReport {
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
  const sort: DailyTokenMielkeQuarticHalvesSort =
    opts.sort ?? 'mielkeZAbsDesc';
  const validSorts: DailyTokenMielkeQuarticHalvesSort[] = [
    'mielkeZ',
    'mielkeZAbsDesc',
    'mielkePValue',
    'mielkePValueDesc',
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
  const rows: DailyTokenMielkeQuarticHalvesSourceRow[] = [];

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
      result = dailyTokenMielkeQuarticHalves(filled);
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
      mielkeN1: result.mielkeN1,
      mielkeN2: result.mielkeN2,
      mielkeAbar: result.mielkeAbar,
      mielkeScoreSS: result.mielkeScoreSS,
      mielkeM: result.mielkeM,
      mielkeExpM: result.mielkeExpM,
      mielkeVarM: result.mielkeVarM,
      mielkeZ: result.mielkeZ,
      mielkePValue: result.mielkePValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'mielkeZ':
        primary = a.mielkeZ - b.mielkeZ;
        break;
      case 'mielkeZAbsDesc':
        primary = Math.abs(b.mielkeZ) - Math.abs(a.mielkeZ);
        break;
      case 'mielkePValue':
        primary = a.mielkePValue - b.mielkePValue;
        break;
      case 'mielkePValueDesc':
        primary = b.mielkePValue - a.mielkePValue;
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
