/**
 * daily-token-pielou-evenness: per-source PIELOU EVENNESS J of
 * the per-day total_tokens distribution.
 *
 * ONE-HUNDRED-AND-FORTY-FOURTH cross-source axis.
 *
 *     H = -sum_i s_i * ln(s_i),   s_i = D_i / sum_j D_j
 *     J = H / ln(n)               for n >= 2
 *
 * with D = (D_1, ..., D_n) the per-source per-day total_tokens
 * vector (one scalar per UTC day, sum of hourly buckets).
 *
 * Pielou's J (Pielou 1966, "The Measurement of Diversity in
 * Different Types of Biological Collections", J. Theoretical
 * Biology 13: 131-144) is the canonical normalisation of
 * Shannon ENTROPY against the uniform-distribution maximum
 * ln(n). It answers **"how evenly is a source's daily token
 * mass spread across its active days?"** on a scale that does
 * NOT depend on n, making short-history and long-history
 * sources directly comparable.
 *
 * RANGE AND BOUNDS:
 *   - H in [0, ln(n)] for n >= 1.
 *   - J in [0, 1] for n >= 2.
 *   - J = 1 iff D is perfectly flat (s_i = 1/n for every i).
 *   - J -> 0 iff a single day carries 100% of the mass
 *     (one-day monopoly: H -> 0 because s ln s -> 0 at s=0
 *     and the lone share at 1 contributes 1*ln(1) = 0).
 *   - SCALE-INVARIANT: J(c * D) = J(D) for any c > 0.
 *   - PERMUTATION-INVARIANT: depends only on the multiset of
 *     shares, not their ordering.
 *
 * SHANNON EFFECTIVE DAYS (refinement, see below):
 *
 *     N_eff^Shannon = exp(H) = Hill number with q = 1
 *
 * is the "exponential-of-entropy" effective number of equally-
 * busy days. Hill (1973, Ecology 54:427) showed that
 * N_eff^q = (sum_i s_i^q)^{1/(1-q)} unifies diversity:
 *   - q = 0  : species richness        (count of nonzero days)
 *   - q = 1  : Shannon Hill number     (THIS axis: exp(H))
 *   - q = 2  : inverse-Simpson         (axis-143: 1 / HHI)
 *   - q -> oo: Berger-Parker dominance (1 / maxShare)
 * As q INCREASES the Hill number puts MORE weight on the
 * largest shares. exp(H) is therefore the unique q=1 member
 * that is STRUCTURALLY ORTHOGONAL to the q=2 inverse-Simpson
 * surfaced by axis-143.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A NEW AXIS:
 *
 *   - vs HHI (axis-143): HHI is the SUM OF SQUARED SHARES, an
 *     L^2 functional on the share simplex. Pielou's J is the
 *     entropy s -> -s ln(s), an L^1-LOG functional. As shares
 *     concentrate, HHI grows QUADRATICALLY while H decays
 *     LOGARITHMICALLY -- the two functionals respond on
 *     different scales to identical mass shifts. They are
 *     RANK-CORRELATED (both measure concentration) but NOT
 *     RANK-EQUIVALENT (see witness below).
 *   - vs CR4 (axis-142): CR4 is a SPARSE TOP-K functional on
 *     a fixed-size set (k = 4). J is a DENSE INTEGRAL: every
 *     day contributes to H via -s_i ln(s_i). CR4 ignores
 *     mass outside the top 4; J does not.
 *   - vs the inequality family (Gini, S-Gini, Atkinson, Theil,
 *     GE, Hoover, Pietra, Bonferroni, Mehran, Wolfson, Foster-
 *     Wolfson, Palma, Kolm-Pollak, Chakravarty, Amato, Esteban-
 *     Ray, FGT, Var-of-Logs, Log-MAD): all normalise by the
 *     MEAN and integrate against the Lorenz curve (linear-ish
 *     in shares). J normalises by the MAXIMUM ENTROPY ln(n)
 *     and integrates -s ln(s) (concave in shares). Atkinson
 *     with epsilon=1 is closest in spirit (also entropy-based)
 *     but Atkinson reports an INEQUALITY index in [0, 1] where
 *     0 = equal; J reports an EVENNESS index where 1 = equal.
 *     They are related by Atkinson_1 = 1 - exp(H - ln(mean*n))
 *     on the MEAN-NORMALISED basis, which differs from J's
 *     ENTROPY-NORMALISED basis whenever shares are not the same
 *     thing as values (i.e. always for non-flat vectors).
 *   - vs the spectral entropy axes: those measure entropy of
 *     the periodogram (frequency-domain). J measures entropy
 *     of the time-domain SHARE VECTOR. Different signal.
 *   - vs the divergence-of-halves family: those compare halves.
 *     J is computed on the WHOLE vector and is permutation-
 *     invariant; halves-divergence is not.
 *
 * RANK-FLIP WITNESS vs HHI (axis-143). Construct two day
 * vectors with the SAME number of days n=10:
 *
 *   A = [50, 50, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]
 *     near-bimodal: two peaks plus eight near-zero "background"
 *     days. total ~ 100.08; two shares ~ 0.4996; eight shares
 *     ~ 0.0001.
 *     HHI(A) ~ 2 * 0.4996^2 + 8 * 0.0001^2 ~ 0.4992
 *     H(A) ~ -2 * 0.4996 * ln(0.4996) - 8 * 0.0001 * ln(0.0001)
 *          ~ -2 * 0.4996 * (-0.6939) - 8 * 0.0001 * (-9.2103)
 *          ~ 0.6932 + 0.0074 = 0.7006
 *     J(A) = 0.7006 / ln(10) = 0.7006 / 2.3026 ~ 0.3043
 *
 *   B = [30, 30, 30, 1, 1, 1, 1, 1, 1, 1]
 *     three peaks + seven uniform background. total = 97;
 *     three shares = 30/97 ~ 0.3093; seven shares = 1/97 ~ 0.0103.
 *     HHI(B) = 3 * (30/97)^2 + 7 * (1/97)^2
 *            ~ 3 * 0.09567 + 7 * 0.000106 = 0.2877
 *     H(B) ~ -3 * 0.3093 * ln(0.3093) - 7 * 0.0103 * ln(0.0103)
 *          ~ -3 * 0.3093 * (-1.1735) - 7 * 0.0103 * (-4.5747)
 *          ~ 1.0890 + 0.3299 = 1.4189
 *     J(B) = 1.4189 / 2.3026 ~ 0.6163
 *
 *   HHI ranks A > B (0.499 > 0.288) -- A is more concentrated.
 *   Pielou ranks B > A (0.616 > 0.304) -- B is more EVEN.
 *   That is the EXPECTED direction (concentration and evenness
 *   are duals) but the MAGNITUDE is informative: HHI says A is
 *   1.7x as concentrated as B; Pielou says B is 2.0x as even.
 *   Crucially, the inverse-Simpson Hill number disagrees with
 *   the Shannon Hill number on the implied "effective day
 *   count":
 *     N_eff^Simpson(A) = 1 / 0.4992 ~ 2.003
 *     N_eff^Shannon(A) = exp(0.7006) ~ 2.015
 *     N_eff^Simpson(B) = 1 / 0.2877 ~ 3.476
 *     N_eff^Shannon(B) = exp(1.4189) ~ 4.133
 *   For A the two effective-day numbers nearly agree (~2);
 *   for B they DIVERGE substantially (3.5 vs 4.1) because
 *   B has a long, even tail of small days that Shannon counts
 *   as "almost a full day" each but Simpson counts as
 *   "negligible because squared shares vanish". Genuine
 *   structural separation: Shannon weights the tail; Simpson
 *   does not.
 *
 * Headline question:
 * **"How evenly is a source's total token mass spread across
 *   its active UTC days, measured on the entropy-normalised
 *   uniform-comparable scale [0, 1]?"**
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 *
 * CLOSED-FORM ANCHOR. For D = [1..10] (n=10):
 *   total = 55
 *   shares = (1/55, 2/55, ..., 10/55)
 *   H = -sum_{k=1..10} (k/55) * ln(k/55)
 *     = -(1/55) * sum_{k=1..10} k * (ln k - ln 55)
 *     = -(1/55) * [sum_{k=1..10} k*ln(k) - ln(55) * sum_{k=1..10} k]
 *     = -(1/55) * [sum_{k=1..10} k*ln(k) - 55 * ln(55)]
 *     = ln(55) - (1/55) * sum_{k=1..10} k*ln(k)
 *   sum_{k=1..10} k*ln(k) = 0 + 2*ln2 + 3*ln3 + 4*ln4 + 5*ln5
 *                          + 6*ln6 + 7*ln7 + 8*ln8 + 9*ln9 + 10*ln10
 *                        ~ 0 + 1.3863 + 3.2958 + 5.5452 + 8.0472
 *                          + 10.7506 + 13.6214 + 16.6355 + 19.7750
 *                          + 23.0259
 *                        ~ 102.0829
 *   H ~ ln(55) - 102.0829 / 55 ~ 4.0073 - 1.8560 ~ 2.1513
 *   J = H / ln(10) ~ 2.1513 / 2.3026 ~ 0.9343
 *   N_eff^Shannon = exp(H) ~ exp(2.1513) ~ 8.5980
 *
 * Sanity: the Hill q=2 number for D=[1..10] is 1/HHI =
 * 3025/385 ~ 7.857 (axis-143). The Hill q=1 number computed
 * here is ~ 8.598. q=1 > q=2 always (Hill numbers are
 * non-increasing in q), confirmed.
 */
import type { QueueLine } from './types.js';

export type DailyTokenPielouEvennessSort =
  | 'evenness'
  | 'entropy'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'effectiveDaysShannon';

export interface DailyTokenPielouEvennessOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenPielouEvennessSort;
  minEvenness?: number | null;
  generatedAt?: string;
}

export interface DailyTokenPielouEvennessSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** Shannon entropy H = -sum s_i ln s_i in nats, range [0, ln(n)]. */
  shannonEntropy: number;
  /** Maximum entropy ln(n) -- the achievable upper bound for H. */
  maxEntropy: number;
  /**
   * Pielou's J = H / ln(n) in [0, 1] for n >= 2.
   * 1 = perfectly flat. 0 = one-day monopoly. NaN-safe: 0 if
   * n < 2 (degenerate -- there is no headroom for unevenness).
   */
  evenness: number;
  /**
   * Refinement: Hill number with q = 1, exp(H), the "Shannon
   * effective number of equally-busy days". For a flat n-day
   * vector, exp(H) = n. For a one-day monopoly, exp(H) = 1.
   * Cross-source comparable on counts. NaN-safe: 0 if n == 0.
   */
  effectiveDaysShannon: number;
  meanDailyTokens: number;
  degenerate: boolean;
  maxDailyTokens: number;
  maxDay: string;
  maxShare: number;
}

export interface DailyTokenPielouEvennessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenPielouEvennessSort;
  minEvenness: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinEvenness: number;
  droppedTopSources: number;
  sources: DailyTokenPielouEvennessSourceRow[];
}

export function pielouEvennessOfVector(values: number[]): {
  shannonEntropy: number;
  maxEntropy: number;
  evenness: number;
  effectiveDaysShannon: number;
  total: number;
  mean: number;
  maxShare: number;
  degenerate: boolean;
} {
  const n = values.length;
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `pielouEvennessOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (n === 0) {
    return {
      shannonEntropy: 0,
      maxEntropy: 0,
      evenness: 0,
      effectiveDaysShannon: 0,
      total: 0,
      mean: 0,
      maxShare: 0,
      degenerate: true,
    };
  }
  if (n === 1) {
    return {
      shannonEntropy: 0,
      maxEntropy: 0,
      evenness: 0,
      effectiveDaysShannon: 1,
      total,
      mean: total,
      maxShare: 1,
      degenerate: true,
    };
  }
  let H = 0;
  let maxShare = 0;
  for (const v of values) {
    const s = v / total;
    // s > 0 guaranteed by the strict-positivity check above, so
    // no s ln(s) -> 0 boundary case to handle here.
    H += -s * Math.log(s);
    if (s > maxShare) maxShare = s;
  }
  const maxEntropy = Math.log(n);
  const evenness = maxEntropy > 0 ? Math.max(0, Math.min(1, H / maxEntropy)) : 0;
  const effectiveDaysShannon = Math.exp(H);
  return {
    shannonEntropy: H,
    maxEntropy,
    evenness,
    effectiveDaysShannon,
    total,
    mean: total / n,
    maxShare,
    degenerate: false,
  };
}

export function buildDailyTokenPielouEvenness(
  queue: QueueLine[],
  opts: DailyTokenPielouEvennessOptions = {},
): DailyTokenPielouEvennessReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Pielou normalisation degenerate for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minEvenness = opts.minEvenness ?? null;
  if (
    minEvenness !== null &&
    (!Number.isFinite(minEvenness) || minEvenness < 0 || minEvenness > 1)
  ) {
    throw new Error(
      `minEvenness must be a finite number in [0, 1] or null (got ${opts.minEvenness})`,
    );
  }
  const sort: DailyTokenPielouEvennessSort = opts.sort ?? 'evenness';
  const validSorts: DailyTokenPielouEvennessSort[] = [
    'evenness',
    'entropy',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'effectiveDaysShannon',
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
  let droppedBelowMinDays = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenPielouEvennessSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nDays = acc.perDay.size;
    if (nDays < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }
    const values: number[] = [];
    let maxDailyTokens = -1;
    let maxDay = acc.firstDay;
    for (const [d, v] of acc.perDay) {
      values.push(v);
      if (v > maxDailyTokens) {
        maxDailyTokens = v;
        maxDay = d;
      }
    }
    const r = pielouEvennessOfVector(values);
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      shannonEntropy: r.shannonEntropy,
      maxEntropy: r.maxEntropy,
      evenness: r.evenness,
      effectiveDaysShannon: r.effectiveDaysShannon,
      meanDailyTokens: r.mean,
      degenerate: r.degenerate,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      maxShare: r.maxShare,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinEvenness = 0;
  let filtered = rows;
  if (minEvenness !== null) {
    const next: DailyTokenPielouEvennessSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.evenness >= minEvenness) next.push(r);
      else droppedBelowMinEvenness += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'days':
        primary = b.nDays - a.nDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'meanDaily':
        primary = b.meanDailyTokens - a.meanDailyTokens;
        break;
      case 'entropy':
        primary = b.shannonEntropy - a.shannonEntropy;
        break;
      case 'effectiveDaysShannon':
        primary = b.effectiveDaysShannon - a.effectiveDaysShannon;
        break;
      case 'evenness':
      default:
        primary = b.evenness - a.evenness;
        break;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
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
    minDays,
    top,
    sort,
    minEvenness,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinEvenness,
    droppedTopSources,
    sources: kept,
  };
}
