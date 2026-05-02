/**
 * daily-token-kendall-tau-autocorrelation-lag1: per-source
 * KENDALL TAU-B SERIAL AUTOCORRELATION at LAG 1 of the
 * gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-EIGHTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Form the two lagged vectors
 *
 *     u = (x[0],   x[1],   ..., x[n-2])
 *     v = (x[1],   x[2],   ..., x[n-1])
 *
 * For every unordered pair of indices {i, j} with i < j in
 * {0, .., m-1}, m = n - 1, classify the bivariate pair
 * ((u[i], v[i]), (u[j], v[j])) as
 *
 *   - CONCORDANT  iff sign(u[j] - u[i]) == sign(v[j] - v[i])
 *                  and both signs are non-zero,
 *   - DISCORDANT  iff sign(u[j] - u[i]) == -sign(v[j] - v[i])
 *                  and both signs are non-zero,
 *   - TIED IN U   iff u[j] == u[i] and v[j] != v[i],
 *   - TIED IN V   iff u[j] != u[i] and v[j] == v[i],
 *   - TIED IN BOTH iff u[j] == u[i] and v[j] == v[i].
 *
 * Let nC, nD, nTU, nTV, nTB be those counts. The total is
 * (m choose 2) = m * (m - 1) / 2. The KENDALL TAU-B
 * SERIAL AUTOCORRELATION (Kendall, 1945; Hollander-Wolfe
 * sec. 8.5) is
 *
 *     tau_b = (nC - nD) /
 *             sqrt((nC + nD + nTU) * (nC + nD + nTV))
 *
 * in [-1, +1]. Tau-b is the standard tie-corrected form;
 * the tie-bearing groups in U and V each scale the
 * denominator down so that tau_b can still attain +/- 1
 * even with moderate tie pressure (in contrast to tau-a,
 * (nC - nD) / (m choose 2), which is bounded strictly
 * inside (-1, +1) whenever any ties exist).
 *
 * Reported alongside `tau`: `nPairs = m`, the full pair
 * breakdown nC / nD / nTU / nTV / nTB, the reference
 * anchor `tauExpectedIid = 0` (asymptotic E[tau_b] under
 * independence, Kendall 1945), and the standardised score
 *
 *     tauZ = tau_b / sqrt(2 * (2*m + 5) / (9 * m * (m - 1)))
 *
 * approximately N(0, 1) for large m under the iid null
 * (Kendall 1945; Hollander-Wolfe sec. 8.5). For m < 4
 * tauZ is reported as 0 (the asymptotic variance formula
 * collapses).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN AXIS
 * IN 79-107:
 *
 *   - Class. KENDALL-TAU-PAIR-CONCORDANCE is a U-statistic
 *     of order 2 (Hoeffding 1948) that counts INVERSIONS in
 *     the joint rank pairing. It is a topological invariant
 *     of the bivariate sample: only the CONCORDANT vs
 *     DISCORDANT classification of each unordered pair
 *     enters; the actual rank LEVELS never appear in the
 *     numerator. This is structurally distinct from any
 *     correlation-of-ranks form.
 *
 *   - vs daily-token-spearman-autocorrelation-lag1
 *     (axis-107). Spearman's rs1 is the PEARSON CORRELATION
 *     of midrank vectors -- a bilinear functional of the
 *     rank LEVELS (rank values 1..n appear quadratically in
 *     the numerator and denominator). Kendall's tau-b
 *     counts CONCORDANT - DISCORDANT pair INVERSIONS -- the
 *     rank LEVELS never appear, only their pairwise order.
 *     The two are functionally independent: there exist
 *     bivariate samples with identical Spearman rho but
 *     different Kendall tau, and vice versa (e.g. Daniels
 *     1944 inequality |3*tau - 2*rho| <= 1, which is tight
 *     -- it bounds but does not determine one from the
 *     other). Operationally tau-b is a U-statistic of order
 *     two (every pair contributes one of five categorical
 *     bits), while Spearman's rho is a bilinear form on
 *     midranks (continuous-valued rank arithmetic).
 *
 *   - vs daily-token-autocorrelation-lag1 (Pearson lag-1).
 *     Pearson lag-1 is the LINEAR serial correlation of the
 *     LEVEL series; outliers can dominate. tau-b is bounded
 *     in [-1, +1] and bounded-influence: a single anomalous
 *     spike at index k can flip at most O(m) pair signs
 *     out of O(m^2), so its leverage shrinks like 1/m. tau-b
 *     is also invariant to any STRICTLY MONOTONE
 *     transformation of the level (log, sqrt, percentile,
 *     scaled affine).
 *
 *   - vs daily-token-autocorrelation-lag7. Different lag.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, Palma, Hoover, ...). All are PERMUTATION-
 *     INVARIANT functionals of the empirical distribution.
 *     tau-b at lag 1 depends on the TEMPORAL ORDER of the
 *     pairs (u[i], v[i]); permuting the daily series
 *     leaves every inequality axis unchanged but rebuilds
 *     the lag-1 pair set entirely.
 *
 *   - vs the symbolic time-domain axes (axis-105 zero-
 *     crossing-rate, axis-106 turning-point-rate, runs-test,
 *     monotone-run-length, second-difference sign runs).
 *     Each collapses the level (or its first/second
 *     difference) to a SIGN sequence and counts events on
 *     that binary sequence. tau-b operates on every
 *     unordered pair of lag-1 windows (O(m^2) comparisons)
 *     rather than a sequential scan (O(m) comparisons), and
 *     uses three-way ordering (less / equal / greater) per
 *     coordinate rather than a two-way binary sign.
 *
 *   - vs the spectral / PSD axes (axis-84 to axis-104).
 *     PSD axes map the WHOLE-tenure periodogram to a
 *     scalar; the periodogram is invariant to TIME-REVERSAL
 *     and discards phase. tau-b is built from rank-pair
 *     comparisons in the natural time direction.
 *
 *   - vs the entropy axes (sample, permutation,
 *     approximate, Renyi spectral, spectral entropy
 *     itself). Those are pattern-recurrence complexity
 *     measures on amplitude / spectral embeddings; tau-b
 *     is a single bivariate U-statistic on the lag-1 pair
 *     set.
 *
 *   - vs the fractal-dimension / long-memory axes
 *     (Higuchi, Katz, Petrosian, Sevcik, box-count, DFA
 *     alpha, Hurst R/S). Those measure scaling exponents
 *     across multiple scales. tau-b is a single-lag local
 *     statistic.
 *
 *   - vs Hjorth (mobility, complexity), Teager-Kaiser, LZ.
 *     Those are continuous-magnitude operators on the
 *     level or its differences. tau-b is rank-pair-count
 *     based and magnitude-blind.
 *
 * Headline question:
 * **"For each source, how often does today's lag-1 (level,
 *   next-level) pair sit ON THE SAME SIDE of any other
 *   day's lag-1 pair, in BOTH coordinates -- net of
 *   anti-concordant pair counts?"**
 *
 * Reference:
 *   Kendall, M. G., "The treatment of ties in ranking
 *     problems", Biometrika 33 (1945), pp. 239-251.
 *   Hoeffding, W., "A class of statistics with
 *     asymptotically normal distribution", Annals of
 *     Mathematical Statistics 19 (1948), pp. 293-325.
 *   Hollander, M. and Wolfe, D. A., "Nonparametric
 *     Statistical Methods" (3rd ed., Wiley, 2014), sec. 8.5
 *     "Kendall and Spearman serial coefficients".
 *   Daniels, H. E., "The relation between measures of
 *     correlation in the universe of sample
 *     permutations", Biometrika 33 (1944), pp. 129-135
 *     (the |3*tau - 2*rho| <= 1 inequality, which is tight
 *     and shows tau and rho are functionally independent).
 *
 * Caveats:
 *
 *   - tau_b in [-1, +1]. tau_b = +1 iff every lag-1 pair
 *     is concordant (and there are no across-pair ties in
 *     either coordinate); tau_b = -1 iff every pair is
 *     discordant.
 *   - The asymptotic-null tauZ formula assumes no ties; in
 *     the tie-heavy gap-filled regime (zero-padded sparse
 *     days) tauZ should be read directionally rather than
 *     as a calibrated p-value.
 *   - All-tied-in-both pairs (nTB) are excluded from BOTH
 *     numerator and denominator; the denominator
 *     (nC + nD + nTU) * (nC + nD + nTV) collapses only when
 *     a coordinate vector is constant -- in that case we
 *     surface the source as `droppedZeroVariance` (matches
 *     the Spearman convention from axis-107).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-kendall-tau-autocorrelation-lag1
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-kendall-tau-autocorrelation-lag1 \
 *     --source vscode-other --json
 *
 *   # Sort by absolute z-score descending (most non-iid
 *   # first):
 *   pew-insights daily-token-kendall-tau-autocorrelation-lag1 \
 *     --sort tauZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenKendallTauAutocorrelationLag1Sort =
  | 'tau'
  | 'tauDesc'
  | 'tauZ'
  | 'tauZDesc'
  | 'tauZAbs'
  | 'tauZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenKendallTauAutocorrelationLag1Options {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4 so at
   * least three lag-1 pairs are available for a meaningful
   * Kendall tau computation.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenKendallTauAutocorrelationLag1Sort;
  generatedAt?: string;
}

export interface DailyTokenKendallTauAutocorrelationLag1SourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /** Number of (x[t], x[t+1]) lag-1 pairs. Equals n - 1. */
  nPairs: number;
  /** Total number of unordered pair-of-pairs comparisons = m*(m-1)/2. */
  nComparisons: number;
  /** Concordant pair-of-pairs count. */
  nConcordant: number;
  /** Discordant pair-of-pairs count. */
  nDiscordant: number;
  /** Tied-in-U-only pair-of-pairs count. */
  nTiedU: number;
  /** Tied-in-V-only pair-of-pairs count. */
  nTiedV: number;
  /** Tied-in-both pair-of-pairs count (excluded from tau-b). */
  nTiedBoth: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** Kendall tau-b serial autocorrelation at lag 1, in [-1, 1]. */
  tau: number;
  /** Standardised score (asymptotic null variance, no-ties form). */
  tauZ: number;
  /** Asymptotic E[tau_b] under independence. */
  tauExpectedIid: number;
}

export interface DailyTokenKendallTauAutocorrelationLag1Report {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenKendallTauAutocorrelationLag1Sort;
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
  sources: DailyTokenKendallTauAutocorrelationLag1SourceRow[];
}

/**
 * Kendall tau-b lag-1 serial autocorrelation primitive on
 * a real-valued series.
 *
 * Forms u = x[0..n-2] and v = x[1..n-1], counts concordant,
 * discordant, tied-U-only, tied-V-only, and tied-in-both
 * unordered pairs of indices in {0..m-1}, then returns the
 * standard tie-corrected Kendall tau-b.
 *
 * Closed-form sanity anchors:
 *   - strictly monotone increasing series x = (1, 2, 3, ...)
 *     -> u = (x[0], .., x[n-2]), v = (x[1], .., x[n-1]),
 *     every unordered pair-of-pairs is concordant (both
 *     u and v rise together with i), so tau_b = +1.
 *   - strictly monotone decreasing -> tau_b = +1 (both u
 *     and v decrease in lockstep, every pair is concordant
 *     in the decreasing direction).
 *   - strict 2-cycle (1, 2, 1, 2, ..., 1) -> u and v are
 *     complementary; for sufficiently long series tau_b is
 *     -1 (every pair is discordant once tie-blocks are
 *     factored out via tau-b).
 *   - i.i.d. continuous sample -> E[tau_b] = 0.
 *
 * Throws when the series is too short, contains non-finite
 * entries, or when either lag-1 coordinate vector is
 * constant (denominator zero).
 *
 * Implementation note: O(m^2) double loop. For the
 * daily-token regime (m ~ 16-72) this is trivial; if longer
 * series ever arrive, swap for the O(m log m) merge-sort
 * inversion-count algorithm of Knight (1966).
 */
export function dailyTokenKendallTauAutocorrelationLag1(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  nPairs: number;
  nComparisons: number;
  nConcordant: number;
  nDiscordant: number;
  nTiedU: number;
  nTiedV: number;
  nTiedBoth: number;
  tau: number;
  tauZ: number;
  tauExpectedIid: number;
} {
  const n = values.length;
  if (n < 3) {
    throw new Error(
      `dailyTokenKendallTauAutocorrelationLag1: need at least 3 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenKendallTauAutocorrelationLag1 requires finite values',
      );
    }
  }

  let mu = 0;
  for (const val of values) mu += val;
  mu /= n;
  let varSum = 0;
  for (const val of values) {
    const d = val - mu;
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

  let nC = 0;
  let nD = 0;
  let nTU = 0;
  let nTV = 0;
  let nTB = 0;
  for (let i = 0; i < m - 1; i += 1) {
    const ui = u[i]!;
    const vi = v[i]!;
    for (let j = i + 1; j < m; j += 1) {
      const du = u[j]! - ui;
      const dv = v[j]! - vi;
      if (du === 0 && dv === 0) {
        nTB += 1;
      } else if (du === 0) {
        nTU += 1;
      } else if (dv === 0) {
        nTV += 1;
      } else if ((du > 0 && dv > 0) || (du < 0 && dv < 0)) {
        nC += 1;
      } else {
        nD += 1;
      }
    }
  }

  const denomU = nC + nD + nTU;
  const denomV = nC + nD + nTV;
  if (denomU <= 0 || denomV <= 0) {
    throw new Error(
      `dailyTokenKendallTauAutocorrelationLag1: zero-variance lag-1 coordinate vector (denomU=${denomU}, denomV=${denomV})`,
    );
  }
  const tau = (nC - nD) / Math.sqrt(denomU * denomV);
  if (!Number.isFinite(tau)) {
    throw new Error(
      `dailyTokenKendallTauAutocorrelationLag1: non-finite tau (nC=${nC}, nD=${nD}, denomU=${denomU}, denomV=${denomV})`,
    );
  }
  // Hollander-Wolfe sec. 8.5: under iid no-ties null,
  // var(tau_a) = 2*(2m+5) / (9*m*(m-1)). Use that as the
  // standardising variance for the tau-b headline; the
  // true tie-corrected variance is more elaborate but the
  // no-ties form is the standard reporting anchor.
  const tauZ =
    m >= 4
      ? tau / Math.sqrt((2 * (2 * m + 5)) / (9 * m * (m - 1)))
      : 0;

  return {
    mean: mu,
    stddev,
    nSamples: n,
    nPairs: m,
    nComparisons: (m * (m - 1)) / 2,
    nConcordant: nC,
    nDiscordant: nD,
    nTiedU: nTU,
    nTiedV: nTV,
    nTiedBoth: nTB,
    tau,
    tauZ,
    tauExpectedIid: 0,
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

export function buildDailyTokenKendallTauAutocorrelationLag1(
  queue: QueueLine[],
  opts: DailyTokenKendallTauAutocorrelationLag1Options = {},
): DailyTokenKendallTauAutocorrelationLag1Report {
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
  const sort: DailyTokenKendallTauAutocorrelationLag1Sort =
    opts.sort ?? 'tauZAbsDesc';
  const validSorts: DailyTokenKendallTauAutocorrelationLag1Sort[] = [
    'tau',
    'tauDesc',
    'tauZ',
    'tauZDesc',
    'tauZAbs',
    'tauZAbsDesc',
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
  const rows: DailyTokenKendallTauAutocorrelationLag1SourceRow[] = [];

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
      result = dailyTokenKendallTauAutocorrelationLag1(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenKendallTauAutocorrelationLag1SourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      nPairs: result.nPairs,
      nComparisons: result.nComparisons,
      nConcordant: result.nConcordant,
      nDiscordant: result.nDiscordant,
      nTiedU: result.nTiedU,
      nTiedV: result.nTiedV,
      nTiedBoth: result.nTiedBoth,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      tau: result.tau,
      tauZ: result.tauZ,
      tauExpectedIid: result.tauExpectedIid,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tau':
        primary = a.tau - b.tau;
        break;
      case 'tauDesc':
        primary = b.tau - a.tau;
        break;
      case 'tauZ':
        primary = a.tauZ - b.tauZ;
        break;
      case 'tauZDesc':
        primary = b.tauZ - a.tauZ;
        break;
      case 'tauZAbs':
        primary = Math.abs(a.tauZ) - Math.abs(b.tauZ);
        break;
      case 'tauZAbsDesc':
        primary = Math.abs(b.tauZ) - Math.abs(a.tauZ);
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
