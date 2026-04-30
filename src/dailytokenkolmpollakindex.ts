/**
 * daily-token-kolm-pollak-index: per-source KOLM-POLLAK index of the
 * per-day total_tokens distribution. FORTY-FOURTH cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the Kolm-Pollak
 * absolute inequality index (Kolm 1976; Pollak 1971):
 *
 *     K(alpha) = (1 / alpha) * ln( (1/n) * sum_i exp( alpha * (mu - D_i) ) )
 *
 * where alpha > 0 is an inequality-aversion parameter with units
 * `1 / tokens`, and mu = mean(D). For numerical stability we use the
 * log-sum-exp identity centred at the maximum shortfall:
 *
 *     K(alpha) = z_max + (1/alpha) * ln( (1/n) * sum_i exp(alpha*(z_i - z_max)) )
 *
 *   with z_i = mu - D_i (the per-day shortfall from the mean) and
 *   z_max = max_i z_i = mu - min_i D_i. Range `[0, max_i (mu - D_i)]`,
 *   in TOKEN units. K = 0 iff every day carries identical mass; K
 *   approaches z_max = (mu - min_i D_i) as alpha -> infinity (the
 *   Rawlsian limit where only the worst-off day matters).
 *
 *   The textbook reading (Atkinson-Stiglitz 1980) is the ABSOLUTE
 *   (additive) inequality dual of Atkinson's RELATIVE (multiplicative)
 *   inequality index. Where Atkinson asks "what fraction of total
 *   mass would the planner give up to flatten the distribution?",
 *   Kolm-Pollak asks "what flat per-day token reduction would the
 *   planner accept to flatten the distribution?". Two distributions
 *   that differ by an additive constant (D and D + c·1) have IDENTICAL
 *   Kolm-Pollak but DIFFERENT Atkinson / Gini / Theil / etc.
 *
 * Why GENUINELY ORTHOGONAL to every prior daily-token axis: the
 * INVARIANCE AXIOM is fundamentally different.
 *
 *   axis-32 daily-token-gini-coefficient: Gini is SCALE-invariant
 *     (G(c·D) = G(D)) but NOT translation-invariant (G(D + c) /= G(D);
 *     adding a flat token amount to every day MOVES Gini towards 0).
 *     Kolm-Pollak is TRANSLATION-invariant (K(D + c) = K(D)) but NOT
 *     scale-invariant (K(c·D) = c · K(D); rescaling tokens rescales K).
 *     POLAR-OPPOSITE invariance axioms.
 *   axis-35 daily-token-pietra-ratio / axis-42 daily-token-hoover-
 *     index / axis-40 daily-token-palma-ratio / axis-41 daily-token-
 *     fgt-index / axis-43 daily-token-bonferroni-index: ALL scale-
 *     invariant (relative). Kolm-Pollak is the ONLY translation-
 *     invariant inequality axis in the suite.
 *   axis-36 daily-token-atkinson-index: Atkinson is the CRRA welfare
 *     loss as a FRACTION of the mean (multiplicative); Kolm-Pollak is
 *     the CARA welfare loss in TOKEN units (additive). The two share
 *     a parameter alpha but Atkinson's epsilon is dimensionless while
 *     Kolm's alpha has units of 1/tokens; identical "shape" alphas
 *     produce different rankings on the same data.
 *   axes 37/38/39 daily-token-theil-l/theil-t/ge2: GE(alpha) is a
 *     family of scale-invariant smooth indices on share ratios.
 *     Kolm-Pollak is translation-invariant and operates on RAW
 *     SHORTFALLS in token units. No monotone bijection.
 *   axis-34 daily-token-zenga-index: Zenga averages bottom-vs-top mean
 *     RATIOS (scale-invariant). Kolm-Pollak averages exp(alpha *
 *     shortfall) (translation-invariant). Different functional class.
 *   All time-ordered axes (autocorrelation, monotone-run-length,
 *     second-difference-sign-runs, z-score-extremes): Kolm-Pollak is
 *     permutation-invariant, so orthogonal by construction.
 *
 *   ORTHOGONALITY WITNESS / cross-anchor: the literal additive-
 *   transform identity. We surface `kolmIfPlusMu` = K(alpha) computed
 *   on the SHIFTED vector D + mu (every day boosted by one mean), and
 *   verify the textbook identity `kolmIfPlusMu == kolm` to within
 *   floating-point tolerance. Every other shipped daily-token index
 *   would CHANGE under the same shift; Kolm-Pollak does not. This is
 *   the structural diagnostic that no relative inequality index can
 *   produce on its own.
 *
 *   Headline question:
 *   **"For each source, what FLAT TOKEN REDUCTION per day would an
 *     inequality-averse planner accept to perfectly flatten the
 *     per-day token distribution? And how does this absolute
 *     (additive) reading reorder sources versus the relative
 *     (multiplicative) Gini / Atkinson / Bonferroni readings?"**
 *
 * Default alpha. Kolm-Pollak's alpha has units of 1/tokens, so the
 * raw alpha that gives a "moderate" inequality reading depends on the
 * mean magnitude of the source. For ergonomic cross-source readings
 * we accept a DIMENSIONLESS aversion parameter `alphaRel` (default
 * 1.0) and compute the per-source effective alpha as
 *
 *     alpha_eff = alphaRel / meanDaily
 *
 * so that alpha_eff * mu = alphaRel is identical across sources. This
 * is the standard way the Kolm-Pollak literature handles cross-unit
 * comparisons (Chakravarty 2009, Sec 3.2). Power users can override
 * by passing `--alpha-absolute` to bypass scaling and use the raw
 * alpha verbatim.
 *
 * ZERO DAYS: a zero-mass day enters as z_i = mu (maximal shortfall),
 * which dominates the log-sum-exp via the exp(alpha * mu) term. This
 * is BY DESIGN -- Kolm-Pollak is the explicit Rawlsian-leaning index
 * and zero days should drive the reading.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 2): Kolm-Pollak is degenerate for n < 2.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'kolm'): 'kolm' | 'tokens' | 'days' | 'source'
 *     | 'meanDaily' | 'rawlsianDeficit' | 'kolmRelativeIntensity'.
 *   - `alphaRel` (default 1.0): dimensionless aversion. Effective
 *     per-source alpha = alphaRel / meanDaily.
 *   - `alphaAbsolute` (default false): when true, use `alphaRel` as
 *     the literal alpha (units 1/tokens) without per-source scaling.
 *   - `minKolm` (default 0): display filter; in token units, >= 0.
 *   - `includeAdditiveInvarianceWitness`: per-row `kolmIfPlusMu` and
 *     `additiveInvarianceResidual = |kolm - kolmIfPlusMu|` proving
 *     translation-invariance numerically.
 *   - `includeRawlsianAnchor`: per-row `rawlsianDeficit = mu - min`
 *     and `kolmOverRawlsian = kolm / rawlsianDeficit` (in [0, 1];
 *     approaches 1 as alpha -> infinity).
 */
import type { QueueLine } from './types.js';
import { giniOfVector } from './dailytokenginicoefficient.js';

export type DailyTokenKolmPollakSort =
  | 'kolm'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'rawlsianDeficit'
  | 'kolmRelativeIntensity';

export interface DailyTokenKolmPollakOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenKolmPollakSort;
  /**
   * Dimensionless inequality aversion (default 1.0). Effective
   * per-source alpha = alphaRel / meanDaily so alpha*mu = alphaRel
   * is identical across sources. Must be > 0.
   */
  alphaRel?: number;
  /**
   * When true, treat `alphaRel` as the literal alpha in 1/tokens
   * without per-source scaling. Use for absolute cross-source
   * comparison at a fixed rate.
   */
  alphaAbsolute?: boolean;
  /** Display filter: drop rows whose kolm < this. In tokens, >= 0. */
  minKolm?: number;
  includeAdditiveInvarianceWitness?: boolean;
  includeRawlsianAnchor?: boolean;
  /**
   * Refinement (v0.6.287): when true, every emitted row gains a
   * `kolmIfTimesTwo` field = K(alpha/2) computed on the SCALED
   * vector 2*D, plus a `scaleEquivarianceResidual` field =
   * |kolmIfTimesTwo - 2*kolm|. The textbook scale-equivariance
   * identity for Kolm-Pollak is K(c*D, alpha/c) = c * K(D, alpha)
   * (homogeneity of degree 1 in the data when alpha is rescaled
   * inversely). Together with the additive-invariance witness
   * (K(D + c, alpha) = K(D, alpha)), this completes the pair of
   * structural axioms that uniquely characterise Kolm-Pollak among
   * all welfare-loss inequality indices (Kolm 1976, Theorem 2).
   * The residual should be ~0 by construction; observing a non-
   * trivial residual would indicate either a numerical pathology
   * or a bug in the log-sum-exp implementation.
   */
  includeScaleEquivarianceWitness?: boolean;
  generatedAt?: string;
}

export interface DailyTokenKolmPollakSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  nZeroDays: number;
  firstDay: string;
  lastDay: string;
  /** Effective alpha actually used (units 1/tokens). */
  alphaEffective: number;
  /** Kolm-Pollak index in TOKEN units, >= 0. */
  kolm: number;
  /** Equivalent flat-per-day token cost: identical to kolm. Surfaced
   * because the planner-interpretation reading is "tokens per day". */
  flatTokenCostPerDay: number;
  /** kolm / meanDaily, dimensionless. Cross-source comparator. */
  kolmRelativeIntensity: number;
  /** Cross-anchor: Gini on the same vector (scale-invariant ref). */
  gini: number;
  meanDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  degenerate: boolean;
  /** Refinement: Kolm-Pollak computed on D + mu. Translation-
   * invariance => kolmIfPlusMu == kolm (within fp tol). */
  kolmIfPlusMu?: number;
  /** Refinement: |kolm - kolmIfPlusMu|. Should be near 0. */
  additiveInvarianceResidual?: number;
  /** Refinement: rawlsianDeficit = mu - min, in tokens. */
  rawlsianDeficit?: number;
  /** Refinement: kolm / rawlsianDeficit in [0, 1]. NaN if deficit=0. */
  kolmOverRawlsian?: number;
  /** Refinement (v0.6.287): K(alpha/2) on the SCALED vector 2*D.
   * By scale-equivariance K(c*D, alpha/c) = c * K(D, alpha) this
   * should equal 2*kolm to within floating-point tolerance. */
  kolmIfTimesTwo?: number;
  /** Refinement (v0.6.287): |kolmIfTimesTwo - 2*kolm|. ~0 by axiom. */
  scaleEquivarianceResidual?: number;
}

export interface DailyTokenKolmPollakReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenKolmPollakSort;
  alphaRel: number;
  alphaAbsolute: boolean;
  minKolm: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinKolm: number;
  droppedTopSources: number;
  sources: DailyTokenKolmPollakSourceRow[];
}

/**
 * Kolm-Pollak index of a non-negative vector at parameter alpha > 0
 * (units 1/tokens). Uses log-sum-exp centred at the max shortfall
 * for numerical stability across the wide token-mass dynamic range.
 *
 * Returns kolm = 0 + degenerate=true for n < 2 or all-zero.
 * Throws on negative / non-finite input or non-positive alpha.
 */
export function kolmPollakOfVector(
  values: number[],
  alpha: number,
): {
  kolm: number;
  mean: number;
  total: number;
  degenerate: boolean;
} {
  if (!Number.isFinite(alpha) || alpha <= 0) {
    throw new Error(`kolmPollakOfVector requires alpha > 0 (got ${alpha})`);
  }
  const n = values.length;
  if (n < 2) {
    const v0 = n === 1 ? (values[0] as number) : 0;
    return { kolm: 0, mean: v0, total: v0, degenerate: true };
  }
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `kolmPollakOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) {
    return { kolm: 0, mean: 0, total: 0, degenerate: true };
  }
  const mu = total / n;
  // z_i = mu - x_i. z_max = mu - min(x).
  let zMax = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    const z = mu - v;
    if (z > zMax) zMax = z;
  }
  // K = z_max + (1/alpha) * ln( (1/n) * sum exp(alpha * (z_i - z_max)) )
  let sumExp = 0;
  for (const v of values) {
    const z = mu - v;
    sumExp += Math.exp(alpha * (z - zMax));
  }
  const kolm = zMax + Math.log(sumExp / n) / alpha;
  // Numerical guard: kolm should be >= 0 in exact arithmetic.
  return {
    kolm: kolm < 0 ? 0 : kolm,
    mean: mu,
    total,
    degenerate: false,
  };
}

export function buildDailyTokenKolmPollakIndex(
  queue: QueueLine[],
  opts: DailyTokenKolmPollakOptions = {},
): DailyTokenKolmPollakReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Kolm-Pollak degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const alphaRel = opts.alphaRel ?? 1.0;
  if (!Number.isFinite(alphaRel) || alphaRel <= 0) {
    throw new Error(`alphaRel must be a finite positive number (got ${opts.alphaRel})`);
  }
  const alphaAbsolute = opts.alphaAbsolute ?? false;
  const minKolm = opts.minKolm ?? 0;
  if (!Number.isFinite(minKolm) || minKolm < 0) {
    throw new Error(
      `minKolm must be a finite non-negative number (got ${opts.minKolm})`,
    );
  }
  const sort: DailyTokenKolmPollakSort = opts.sort ?? 'kolm';
  const validSorts: DailyTokenKolmPollakSort[] = [
    'kolm',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'rawlsianDeficit',
    'kolmRelativeIntensity',
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
  const rows: DailyTokenKolmPollakSourceRow[] = [];

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
    let minDailyTokens = Number.POSITIVE_INFINITY;
    let minDay = acc.firstDay;
    let nZeroDays = 0;
    for (const [d, v] of acc.perDay) {
      values.push(v);
      if (v === 0) nZeroDays += 1;
      if (v > maxDailyTokens) {
        maxDailyTokens = v;
        maxDay = d;
      }
      if (v < minDailyTokens) {
        minDailyTokens = v;
        minDay = d;
      }
    }
    const meanDaily = acc.totalTokens / nDays;
    const alphaEffective = alphaAbsolute ? alphaRel : alphaRel / meanDaily;
    const k = kolmPollakOfVector(values, alphaEffective);
    const gini = giniOfVector(values);
    const kolmRelativeIntensity = meanDaily > 0 ? k.kolm / meanDaily : 0;
    const row: DailyTokenKolmPollakSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nZeroDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      alphaEffective,
      kolm: k.kolm,
      flatTokenCostPerDay: k.kolm,
      kolmRelativeIntensity,
      gini,
      meanDailyTokens: meanDaily,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
      degenerate: k.degenerate,
    };
    if (opts.includeAdditiveInvarianceWitness) {
      const shifted = values.map((v) => v + meanDaily);
      // alpha is intrinsic to the per-source kolm reading; keep
      // alphaEffective the same so the witness tests INVARIANCE
      // of the index, not invariance of the parameter.
      const k2 = kolmPollakOfVector(shifted, alphaEffective);
      row.kolmIfPlusMu = k2.kolm;
      row.additiveInvarianceResidual = Math.abs(k.kolm - k2.kolm);
    }
    if (opts.includeRawlsianAnchor) {
      const deficit = meanDaily - row.minDailyTokens;
      row.rawlsianDeficit = deficit;
      row.kolmOverRawlsian = deficit > 0 ? k.kolm / deficit : Number.NaN;
    }
    if (opts.includeScaleEquivarianceWitness) {
      const scaled = values.map((v) => v * 2);
      // K(2*D, alpha/2) = 2 * K(D, alpha) (Kolm-Pollak homogeneity
      // of degree 1 when alpha is rescaled inversely).
      const k3 = kolmPollakOfVector(scaled, alphaEffective / 2);
      row.kolmIfTimesTwo = k3.kolm;
      row.scaleEquivarianceResidual = Math.abs(k3.kolm - 2 * k.kolm);
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinKolm = 0;
  let filtered = rows;
  if (minKolm > 0) {
    const next: DailyTokenKolmPollakSourceRow[] = [];
    for (const r of rows) {
      if (r.kolm >= minKolm) next.push(r);
      else droppedBelowMinKolm += 1;
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
      case 'rawlsianDeficit':
        primary =
          (b.meanDailyTokens - b.minDailyTokens) -
          (a.meanDailyTokens - a.minDailyTokens);
        break;
      case 'kolmRelativeIntensity':
        primary = b.kolmRelativeIntensity - a.kolmRelativeIntensity;
        break;
      case 'kolm':
      default:
        primary = b.kolm - a.kolm;
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
    alphaRel,
    alphaAbsolute,
    minKolm,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinKolm,
    droppedTopSources,
    sources: kept,
  };
}
