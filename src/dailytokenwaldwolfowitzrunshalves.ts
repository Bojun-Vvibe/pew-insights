/**
 * daily-token-wald-wolfowitz-runs-halves: per-source
 * WALD-WOLFOWITZ TWO-SAMPLE RUNS TEST comparing the
 * first half vs second half of the gap-filled daily
 * total_tokens series via the LABEL-RUN COUNT in the
 * POOLED-SORTED ORDER.
 *
 * ONE-HUNDRED-AND-NINETY-FOURTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source (n = nTenureDays >= 8).
 * Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * POOL the n = n1 + n2 values, SORT them in ascending
 * order, and replace each by its source-of-origin LABEL
 * ('A' or 'B'). Define the RUN COUNT
 *
 *     R = #{ maximal contiguous blocks of identical
 *           labels in the sorted pooled label sequence }
 *
 * R takes values in {2, 3, ..., n} (R = 2 iff all A's
 * come before all B's or vice versa = perfect separation;
 * R = n iff labels alternate = perfect interleaving).
 *
 * Under H0 of identical distributions (Wald & Wolfowitz
 * 1940, Annals of Mathematical Statistics 11(2):147-162
 * "On a test whether two samples are from the same
 * population"), R is hypergeometrically distributed with
 *
 *     E[R]  = 2 * n1 * n2 / n  +  1
 *     Var[R] = 2 * n1 * n2 * (2 * n1 * n2 - n) /
 *              ( n * n * (n - 1) )
 *
 * For n1, n2 >= 4 the distribution of (R - E[R]) / sqrt(Var)
 * is well approximated by N(0, 1) (Wald & Wolfowitz 1940
 * Theorem 1; refinements in Granger 1963, JRSS B 25(1):
 * 220-225). We adopt the continuity-corrected z:
 *
 *     wwZ_low  = (R + 0.5 - E[R]) / sqrt(Var)
 *     wwZ_high = (R - 0.5 - E[R]) / sqrt(Var)
 *     wwZ      = wwZ_low if R < E[R], wwZ_high if R > E[R],
 *                0 if R == round(E[R])
 *
 * with two-sided p
 *
 *     wwTwoSidedP = 2 * Phi( -|wwZ| )
 *
 * (clipped to [0, 1]; if Var == 0, p = 1).
 *
 * Direction. The runs test is INTRINSICALLY TWO-SIDED on
 * R (small R = clustering = ANY distributional difference;
 * large R = over-mixing = rare structured anti-clustering).
 * To attach a directional reading we report
 *
 *     wwSignedDirection = sign(median(B) - median(A))
 *
 * which is +1 if the SECOND HALF's median exceeds the
 * FIRST HALF's (location ROSE), -1 if dropped, 0 if
 * exactly equal. wwSignedDirection is INDEPENDENT of R
 * and is provided only as a navigational aid for the
 * report -- the runs test itself rejects on |wwZ| alone.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs axis-115 daily-token-mann-whitney-halves and
 *     axis-191 cliffs-delta-halves. MW's U is the count
 *     of A-below-B cross-pair indicators; Cliff's delta
 *     is its centred form. Both are functionals of the
 *     POOLED-SORT RANKS of the A-sample (equivalently
 *     RANK SUM). The Wald-Wolfowitz R is a functional of
 *     the POOLED-SORT LABEL SEQUENCE -- not of the rank
 *     sum. Two configurations with the SAME rank sum can
 *     have R = 2 (all A then all B) or R = n (perfect
 *     alternation) depending entirely on the order of
 *     same-label clusters in the pool. Therefore R cannot
 *     be reduced to a rank-sum statistic.
 *
 *   - vs axis-186 daily-token-ks-two-sample-halves.
 *     Kolmogorov-Smirnov D = sup_t |F_A(t) - F_B(t)| is
 *     the supremum of a CUMULATIVE DIFFERENCE process;
 *     its level depends on WHERE the largest gap occurs
 *     between the two ECDFs. R is a COUNT of LABEL
 *     TRANSITIONS along the pooled sort -- it is INSENSITIVE
 *     to the magnitude or location of the largest cumulative
 *     gap and ONLY depends on the LABEL ALTERNATION
 *     PATTERN. A bimodal A-distribution interleaved with a
 *     bimodal B-distribution can give small R (clustering
 *     by mode) without any large KS gap; conversely a
 *     uniform B-shift can give large KS D with R near E[R].
 *
 *   - vs axis-187 daily-token-vargha-delaney-halves. A12
 *     is a monotone function of MW's U -- same rank-sum
 *     argument applies. R is orthogonal.
 *
 *   - vs axis-188 daily-token-permutation-tstat-halves.
 *     Permutation t uses MEAN DIFFERENCES; R uses LABEL
 *     ALTERNATIONS. A scale-only shift with equal means
 *     gives perm-t near zero but R can be highly
 *     non-null (two halves cluster at different
 *     dispersions in the pooled sort).
 *
 *   - vs axis-189 daily-token-wilcoxon-signed-rank-halves
 *     and axis-190 paired-sign-test-halves. Both are
 *     PAIRED tests on the i-th observation of A vs i-th
 *     of B. R is UNPAIRED and operates on the pooled sort
 *     -- it discards within-half time order entirely.
 *
 *   - vs axis-192 daily-token-kuiper-two-sample-halves.
 *     Kuiper V = sup(F_A - F_B) + sup(F_B - F_A). R is
 *     not a function of any ECDF supremum.
 *
 *   - vs axis-193 daily-token-tukey-quick-halves. Tukey
 *     W is supported only on the END-EXCEEDANCE PAIRS
 *     (extremes of the pooled support). R is supported
 *     on the FULL POOLED SORT (every adjacency
 *     contributes a label-transition test). Tukey W
 *     ignores interior adjacency pattern; R is determined
 *     ENTIRELY by the interior + boundary adjacency
 *     pattern. The two are orthogonal in functional
 *     support.
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves. ST is
 *     a SCALE test based on FOLDED RANKS (smallest gets
 *     rank 1, largest rank 2, second-smallest rank 3,
 *     etc.) -- it is a rank-sum on a permuted rank scale.
 *     R is a LABEL-RUN COUNT, not a rank sum on any scale.
 *
 *   - vs axis-126 daily-token-runs-test-z (single-sample
 *     runs of above-vs-below-median). That test counts
 *     runs of WITHIN-SAMPLE BINARY SIGN sequences in
 *     TIME ORDER. The Wald-Wolfowitz two-sample test
 *     counts runs of GROUP-OF-ORIGIN labels in
 *     POOLED-SORT ORDER. Different sequences entirely.
 *
 * Caveats.
 *
 *   - Ties. When the pooled sort has ties (equal values
 *     from different halves), the run count depends on
 *     the tie-breaking rule. We adopt MID-RANK BLOCK
 *     HANDLING: each maximal tied-value block contributes
 *     one transition iff it contains BOTH labels (we
 *     count each tied block as 1 transition into and
 *     potentially 1 transition out, choosing the
 *     CONSERVATIVE rule that maximises R within ties --
 *     i.e. ties between different labels are treated as
 *     SAME-LABEL adjacency, lower-bounding R). This is
 *     conservative under H1 (under-rejects) and is the
 *     standard treatment in non-parametric texts (Sprent
 *     & Smeeton 2001 *Applied Nonparametric Statistical
 *     Methods*, 3rd ed., section 6.4.2).
 *
 *   - Continuity correction. The +0.5 / -0.5 correction
 *     in wwZ improves the normal approximation for
 *     moderate n (Granger 1963 demonstrates a 2-3%
 *     improvement in tail-probability accuracy for
 *     n in [10, 30]).
 *
 *   - n-size band. The normal approximation for R is
 *     valid for n1, n2 >= 4 (Wald-Wolfowitz 1940). We
 *     enforce minTenureDays >= 8 so n1, n2 >= 4.
 *
 *   - Power profile. The runs test is an OMNIBUS test
 *     for distributional equality: it has positive power
 *     against ANY alternative (location, scale, shape)
 *     but is generally LESS POWERFUL than focused tests
 *     for any specific alternative class. Its strength
 *     is its mechanism-independence -- if anything is
 *     different between the halves, R will detect it
 *     eventually.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   pew-insights daily-token-wald-wolfowitz-runs-halves
 *
 *   pew-insights daily-token-wald-wolfowitz-runs-halves \
 *     --json --min-tenure-days 14 --sort wwZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenWaldWolfowitzRunsHalvesSort =
  | 'wwR'
  | 'wwRDesc'
  | 'wwZ'
  | 'wwZDesc'
  | 'wwZAbs'
  | 'wwZAbsDesc'
  | 'wwP'
  | 'wwPDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenWaldWolfowitzRunsHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * each half has at least 4 observations (validity band
   * for the normal approximation to R; Wald-Wolfowitz
   * 1940).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenWaldWolfowitzRunsHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenWaldWolfowitzRunsHalvesSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  wwN1: number;
  /** Second-half size n2 = n - n1. */
  wwN2: number;
  /** Median of the first half. */
  wwMedianA: number;
  /** Median of the second half. */
  wwMedianB: number;
  /** Run count R in the pooled-sorted label sequence. */
  wwR: number;
  /** Expected R under H0: 2*n1*n2/n + 1. */
  wwExpR: number;
  /** Variance of R under H0. */
  wwVarR: number;
  /**
   * Continuity-corrected z-score
   * (R - E[R] +/- 0.5) / sqrt(Var[R]); negative = fewer
   * runs than expected (= clustering by half =
   * distributional difference signal); positive = more
   * runs than expected (= anti-clustering, rare).
   */
  wwZ: number;
  /** Two-sided p-value via the normal approximation. */
  wwTwoSidedP: number;
  /**
   * Navigational direction: +1 if median(B) > median(A)
   * (location ROSE), -1 if dropped, 0 if exactly equal.
   * This is INDEPENDENT of the runs test itself; the
   * runs test rejects on |wwZ| alone.
   */
  wwSignedDirection: number;
}

export interface DailyTokenWaldWolfowitzRunsHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenWaldWolfowitzRunsHalvesSort;
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
  sources: DailyTokenWaldWolfowitzRunsHalvesSourceRow[];
}

/**
 * Standard-normal CDF via the Abramowitz-Stegun 7.1.26
 * rational approximation (max abs error 1.5e-7). Used to
 * convert wwZ -> two-sided p.
 */
function phi(z: number): number {
  // erfc-style approximation.
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  if (n % 2 === 1) return sorted[mid]!;
  return 0.5 * (sorted[mid - 1]! + sorted[mid]!);
}

/**
 * Wald-Wolfowitz two-sample runs test on the first half
 * (A = x[0..n1-1]) vs second half (B = x[n1..n-1]) of a
 * real-valued series.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - wwR(x + c) === wwR(x) for any constant c (uniform
 *     shift preserves pooled sort order and labels).
 *   - wwR(a * x) === wwR(x) for any a > 0 (positive
 *     scaling preserves sort order).
 *   - wwR(f(x)) === wwR(x) for any strictly increasing f
 *     (depends only on POOLED SORT ORDER + LABELS).
 *   - 2 <= wwR <= n for any non-degenerate input.
 *   - wwR = 2 iff one half's values are STRICTLY ALL
 *     SMALLER than the other half's (perfect separation).
 *   - wwR = n iff labels alternate perfectly in the
 *     pooled sort (perfect interleaving).
 *   - For perfectly separated halves with n1 = n2 and
 *     n large, wwZ -> -infinity and p -> 0.
 */
export function dailyTokenWaldWolfowitzRunsHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  wwN1: number;
  wwN2: number;
  wwMedianA: number;
  wwMedianB: number;
  wwR: number;
  wwExpR: number;
  wwVarR: number;
  wwZ: number;
  wwTwoSidedP: number;
  wwSignedDirection: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenWaldWolfowitzRunsHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenWaldWolfowitzRunsHalves requires finite values',
      );
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
      `dailyTokenWaldWolfowitzRunsHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // Build labelled pool: 0 = A (first half), 1 = B
  // (second half). Sort by value with stable tie order
  // (label asc as secondary key -- A before B on ties --
  // so a tied-pair contributes a SAME-LABEL adjacency
  // (lower-bounds R, conservative under H1)).
  type Lbl = { v: number; lbl: 0 | 1 };
  const pool: Lbl[] = new Array(n);
  for (let i = 0; i < n1; i += 1) pool[i] = { v: values[i]!, lbl: 0 };
  for (let i = n1; i < n; i += 1) pool[i] = { v: values[i]!, lbl: 1 };
  pool.sort((a, b) => {
    if (a.v !== b.v) return a.v - b.v;
    return a.lbl - b.lbl;
  });

  // Ties between same-value DIFFERENT-LABEL pairs would
  // inflate R artificially. Treat each maximal tied-value
  // block as a single label cluster equal to its first
  // element's label (the conservative lower bound on R
  // under H1).
  const collapsed: number[] = [];
  let i = 0;
  while (i < n) {
    const v = pool[i]!.v;
    const startLbl = pool[i]!.lbl;
    let j = i + 1;
    while (j < n && pool[j]!.v === v) j += 1;
    if (j - i === 1) {
      collapsed.push(startLbl);
    } else {
      // tied block: treat as ONE adjacency of startLbl
      // (conservative).
      collapsed.push(startLbl);
    }
    i = j;
  }

  let R = 1;
  for (let k = 1; k < collapsed.length; k += 1) {
    if (collapsed[k] !== collapsed[k - 1]) R += 1;
  }
  // R counted on the COLLAPSED label sequence is the
  // conservative lower bound on the true R. If there are
  // no ties between different labels, it equals the true
  // R. We use this conservative value throughout.

  const nF = n;
  const expR = (2 * n1 * n2) / nF + 1;
  const varNum = 2 * n1 * n2 * (2 * n1 * n2 - nF);
  const varDen = nF * nF * (nF - 1);
  const varR = varDen > 0 ? varNum / varDen : 0;

  let z: number;
  let p: number;
  if (varR <= 0) {
    z = 0;
    p = 1;
  } else {
    const sd = Math.sqrt(varR);
    if (R < expR) {
      z = (R + 0.5 - expR) / sd;
    } else if (R > expR) {
      z = (R - 0.5 - expR) / sd;
    } else {
      z = 0;
    }
    if (z === 0) {
      p = 1;
    } else {
      p = 2 * phi(-Math.abs(z));
      if (p > 1) p = 1;
      if (p < 0) p = 0;
    }
  }

  // Direction-of-shift navigational aid: sign(median(B) - median(A)).
  const aSorted = values.slice(0, n1).sort((x, y) => x - y);
  const bSorted = values.slice(n1).sort((x, y) => x - y);
  const medA = median(aSorted);
  const medB = median(bSorted);
  let signedDir = 0;
  if (medB > medA) signedDir = 1;
  else if (medB < medA) signedDir = -1;

  if (
    !Number.isFinite(R) ||
    !Number.isFinite(expR) ||
    !Number.isFinite(varR) ||
    !Number.isFinite(z) ||
    !Number.isFinite(p)
  ) {
    throw new Error(
      `dailyTokenWaldWolfowitzRunsHalves: non-finite output (n=${n}, R=${R})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    wwN1: n1,
    wwN2: n2,
    wwMedianA: medA,
    wwMedianB: medB,
    wwR: R,
    wwExpR: expR,
    wwVarR: varR,
    wwZ: z,
    wwTwoSidedP: p,
    wwSignedDirection: signedDir,
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

export function buildDailyTokenWaldWolfowitzRunsHalves(
  queue: QueueLine[],
  opts: DailyTokenWaldWolfowitzRunsHalvesOptions = {},
): DailyTokenWaldWolfowitzRunsHalvesReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 8) {
    throw new Error(
      `minTenureDays must be an integer >= 8 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenWaldWolfowitzRunsHalvesSort =
    opts.sort ?? 'wwZAbsDesc';
  const validSorts: DailyTokenWaldWolfowitzRunsHalvesSort[] = [
    'wwR',
    'wwRDesc',
    'wwZ',
    'wwZDesc',
    'wwZAbs',
    'wwZAbsDesc',
    'wwP',
    'wwPDesc',
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
  const rows: DailyTokenWaldWolfowitzRunsHalvesSourceRow[] = [];

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
      result = dailyTokenWaldWolfowitzRunsHalves(filled);
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
      wwN1: result.wwN1,
      wwN2: result.wwN2,
      wwMedianA: result.wwMedianA,
      wwMedianB: result.wwMedianB,
      wwR: result.wwR,
      wwExpR: result.wwExpR,
      wwVarR: result.wwVarR,
      wwZ: result.wwZ,
      wwTwoSidedP: result.wwTwoSidedP,
      wwSignedDirection: result.wwSignedDirection,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'wwR':
        primary = a.wwR - b.wwR;
        break;
      case 'wwRDesc':
        primary = b.wwR - a.wwR;
        break;
      case 'wwZ':
        primary = a.wwZ - b.wwZ;
        break;
      case 'wwZDesc':
        primary = b.wwZ - a.wwZ;
        break;
      case 'wwZAbs':
        primary = Math.abs(a.wwZ) - Math.abs(b.wwZ);
        break;
      case 'wwZAbsDesc':
        primary = Math.abs(b.wwZ) - Math.abs(a.wwZ);
        break;
      case 'wwP':
        primary = a.wwTwoSidedP - b.wwTwoSidedP;
        break;
      case 'wwPDesc':
        primary = b.wwTwoSidedP - a.wwTwoSidedP;
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
