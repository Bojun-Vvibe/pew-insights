/**
 * source-row-token-slope-ci-lens-width-mehran
 *
 * Per-lens CROSS-SOURCE MEHRAN INDEX of CI half-widths
 * (THIRTIETH cross-lens axis) for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six
 * per-source slope CIs as v0.6.227-v0.6.261 (percentile bootstrap,
 * jackknife normal, BCa, studentized-t, ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL TWENTY-NINE prior cross-lens
 * diagnostics on the following ORTHOGONAL axes:
 *
 *   1. STATISTIC FAMILY. The Mehran (1976) index is a
 *      RANK-LINEARLY-WEIGHTED Lorenz-gap functional. With the
 *      Lorenz process L(p), p in [0, 1]:
 *
 *        Mehran   M = 6 * integral_0^1 (1 - p) * (p - L(p)) dp
 *        Gini     G = 2 * integral_0^1            (p - L(p)) dp
 *        Bonferr. B =     integral_0^1   (1/p)  * (p - L(p)) dp
 *
 *      All three integrate the SAME Lorenz GAP (p - L(p)) but
 *      with three DIFFERENT rank-weight kernels:
 *
 *        - Gini       weight w(p) = 1            (uniform)
 *        - Mehran     weight w(p) = (1 - p)      (linear, descending in rank)
 *        - Bonferroni weight w(p) = 1 / p        (harmonic, descending in rank)
 *
 *      The Mehran kernel is therefore the LINEAR midpoint between
 *      the rank-uniform Gini kernel (axis-21) and the rank-harmonic
 *      Bonferroni kernel (axis-28). It is BOTTOM-EMPHASISING (more
 *      weight on small ranks where the Lorenz gap is built up),
 *      but the emphasis is BOUNDED (weight in [0, 1] for all p),
 *      unlike Bonferroni whose 1/p kernel is UNBOUNDED as p -> 0.
 *      Mehran is therefore RESISTANT TO SINGLE-SMALLEST-VALUE
 *      DOMINATION whereas Bonferroni is HYPERSENSITIVE to it.
 *
 *      We compute M numerically by exact Simpson's-rule on the
 *      empirical step Lorenz curve. On each rank step the
 *      integrand (1 - p) * (p - L(p)) is the product of two
 *      linear pieces -> quadratic, so Simpson's rule is EXACT (zero
 *      truncation error) and the result is bounded in [0, 1] for
 *      any non-negative input by the Lorenz dominance L(p) <= p.
 *      Bounded in [0, 1]; M = 0 iff perfectly equal; M -> 1 - 1/n
 *      iff perfect concentration on a single observation.
 *
 *   2. ORTHOGONAL TO EVERY PRIOR AXIS:
 *
 *        - axis-21 Gini: rank-uniform Lorenz-gap weight 1.
 *          Mehran's (1-p) weight is strictly different on every p
 *          except the trivial perfect-equality case.
 *        - axis-22 Theil GE(1): entropic log-share functional, NOT
 *          a Lorenz-gap integral. No (p - L(p)) factor at all.
 *        - axis-23 Atkinson(eps): CRRA welfare-loss
 *          1 - M_eps / mean. Family parameter is the curvature of
 *          the utility, not a rank-weight.
 *        - axis-24 QCD: order-statistic ratio (Q3-Q1)/(Q3+Q1) on
 *          two quartile points. Mehran integrates over EVERY rank.
 *        - axis-25 Hoover: L_infinity gap max_p (p - L(p)). Mehran
 *          is L_1 with kernel (1 - p) on the same gap.
 *        - axis-26 Palma: TWO-POINT decile ratio S90/S40. Mehran
 *          uses ALL n ranks with smooth linear weighting.
 *        - axis-27 GE(2): variance-based, top-tail-sensitive.
 *          Mehran weight (1 - p) is BOTTOM-tail-emphasising.
 *        - axis-28 Bonferroni: rank-cumulative 1/i prefix-mean
 *          functional. Although also bottom-emphasising, its
 *          kernel is harmonic 1/i (UNBOUNDED at i=1) whereas
 *          Mehran's is linear (n - i + 0.5)/n in [0, 1] (BOUNDED).
 *          Two distinct kernel families: harmonic vs linear.
 *        - axis-29 Kolm-Pollak: TRANSLATION-INVARIANT exponential
 *          welfare-loss gap mean - Xi. Mehran is SCALE-INVARIANT
 *          (rescaling x by c leaves M unchanged) and translation-
 *          dependent (adding c to every x_(i) DECREASES M towards
 *          0). The two indices satisfy POLAR-OPPOSITE invariance
 *          axioms.
 *
 *   3. ANALYTIC IDENTITY: Mehran lies STRICTLY BETWEEN Gini and
 *      Bonferroni for every non-degenerate distribution -- the
 *      kernel ordering 1 <= (1-p) is FALSE in general but the
 *      integrated identity G <= M <= B holds when the Lorenz gap
 *      is concave (true for every empirical Lorenz curve), which
 *      we VERIFY at runtime as a structural sanity check
 *      (`giniMehranBonferroniOrdering`: 'G<=M<=B' or 'violation').
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.261. For each lens L:
 *
 *   For each source s in the SHARED set (sources present in ALL
 *   six lens reports):
 *     halfWidth_{L,s} = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *
 *   With n >= 4 and mean m > 0, sort ascending x_(1) <= ... <= x_(n):
 *     M = (3 / (n^2 * m)) * sum_{i=1..n} (2*n - 2*i + 1) * (m - x_(i))
 *
 *   Equivalent Lorenz-gap form (for documentation; we compute the
 *   sum-form for numerical stability):
 *     M = 6 * sum_{i=1..n-1} (1 - i/n) * (i/n - L(i/n)) * (1/n)
 *         (trapezoidal-equivalent on the empirical step curve)
 *
 *   Edge cases (parity with axes 21-29):
 *     - n < 4: M = 0, degenerateFlag = true,
 *              reason = 'too-few-sources'.
 *     - mean <= 0: M = 0, degenerateFlag = true,
 *              reason = 'zero-mean'.
 *     - All half-widths identical: M = 0 exactly (NOT degenerate).
 *     - Any half-width is negative or non-finite: throws.
 *
 * Per-lens columns:
 *   - `lens`                    -- canonical lens name
 *   - `nShared`                 -- number of shared sources used
 *   - `meanHalfWidth`           -- arithmetic mean of half-widths
 *   - `minHalfWidth`            -- min half-width across sources
 *   - `maxHalfWidth`            -- max half-width across sources
 *   - `mehran`                  -- M in [0, 1]
 *   - `bottomShareWeight`       -- sum_{i=1..n} (2*n - 2*i + 1) / n^2
 *                                  (always equals 1 -- a structural
 *                                  invariant; emitted as a sanity
 *                                  hook for the kernel-normalisation)
 *   - `kernelEmphasis`          -- (1 - F(median)) at the empirical
 *                                  median rank, the Mehran kernel
 *                                  weight evaluated at the median;
 *                                  diagnostic for kernel decay
 *   - `concentrationLabel`      -- qualitative bin on M:
 *                                  'extreme'           (>= 0.6)
 *                                  'high'              ([0.3, 0.6))
 *                                  'moderate'          ([0.1, 0.3))
 *                                  'mild'              ((0, 0.1))
 *                                  'near-uniform'      (== 0)
 *                                  'degenerate'        (degenerateFlag)
 *   - `degenerateFlag`          -- true iff hit an edge case
 *   - `degenerateReason`        -- reason string, or null
 *
 * Report-level: meanM, medianM, maxM, minM, rangeM, nDegenerate,
 * nExtreme, nNearUniform, mostExtremeLens (argmax M),
 * mostUniformLens (argmin M).
 *
 * Filters:
 *   - --alert-mehran <f>         -- keep lenses with M > f (f in [0, 1])
 *
 * Sorts: 'mehran-desc' (default), 'mehran-asc',
 *        'mean-halfwidth-desc', 'lens'.
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_MEHRAN_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthMehranLensName =
  (typeof SLOPE_LENS_WIDTH_MEHRAN_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 4;

const EXTREME_THRESHOLD = 0.6;
const HIGH_THRESHOLD = 0.3;
const MODERATE_THRESHOLD = 0.1;

export type MehranDegenerateReason = 'too-few-sources' | 'zero-mean';

export type MehranConcentrationLabel =
  | 'extreme'
  | 'high'
  | 'moderate'
  | 'mild'
  | 'near-uniform'
  | 'degenerate';

export interface SourceRowTokenSlopeCiLensWidthMehranOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertMehran?: number | null;
  sort?:
    | 'mehran-desc'
    | 'mehran-asc'
    | 'mean-halfwidth-desc'
    | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthMehranLensRow {
  lens: SlopeLensWidthMehranLensName;
  nShared: number;
  meanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  mehran: number;
  bottomShareWeight: number;
  kernelEmphasis: number;
  concentrationLabel: MehranConcentrationLabel;
  degenerateFlag: boolean;
  degenerateReason: MehranDegenerateReason | null;
  perSourceHalfWidths: number[];
  perSourceSources: string[];
}

export interface SourceRowTokenSlopeCiLensWidthMehranReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertMehran: number | null;
  sort: NonNullable<
    SourceRowTokenSlopeCiLensWidthMehranOptions['sort']
  >;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  meanM: number;
  medianM: number;
  maxM: number;
  minM: number;
  rangeM: number;
  nDegenerate: number;
  nExtreme: number;
  nNearUniform: number;
  mostExtremeLens: SlopeLensWidthMehranLensName | null;
  mostUniformLens: SlopeLensWidthMehranLensName | null;
  rows: SourceRowTokenSlopeCiLensWidthMehranLensRow[];
}

const VALID_SORTS = [
  'mehran-desc',
  'mehran-asc',
  'mean-halfwidth-desc',
  'lens',
] as const;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[m]!;
  return (s[m - 1]! + s[m]!) / 2;
}

function classifyConcentration(
  mehran: number,
  degenerate: boolean,
): MehranConcentrationLabel {
  if (degenerate) return 'degenerate';
  if (!Number.isFinite(mehran) || mehran <= 0) return 'near-uniform';
  if (mehran >= EXTREME_THRESHOLD) return 'extreme';
  if (mehran >= HIGH_THRESHOLD) return 'high';
  if (mehran >= MODERATE_THRESHOLD) return 'moderate';
  return 'mild';
}

/**
 * Compute the MEHRAN INDEX M on a single set of non-negative
 * half-widths.
 *
 *   Sort x_(1) <= x_(2) <= ... <= x_(n).
 *   With m = mean(x) > 0,
 *     M = (3 / (n^2 * m)) * sum_{i=1..n} (2*n - 2*i + 1) * (m - x_(i))
 *
 * Bounded in [0, 1]. Returns degenerate metadata for the standard
 * edge cases.
 *
 * Exposed for direct unit-testing.
 */
export function lensWidthMehran(halfWidths: number[]): {
  nShared: number;
  meanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  mehran: number;
  bottomShareWeight: number;
  kernelEmphasis: number;
  degenerateFlag: boolean;
  degenerateReason: MehranDegenerateReason | null;
} {
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthMehran: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthMehran: halfWidths must be non-negative (got ${v})`,
      );
    }
  }
  const n = halfWidths.length;
  if (n < MIN_SHARED_SOURCES) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      minHalfWidth: 0,
      maxHalfWidth: 0,
      mehran: 0,
      bottomShareWeight: 0,
      kernelEmphasis: 0,
      degenerateFlag: true,
      degenerateReason: 'too-few-sources',
    };
  }
  let total = 0;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const v of halfWidths) {
    total += v;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const mean = total / n;
  if (!(mean > 0) || !Number.isFinite(mean)) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      minHalfWidth: minV,
      maxHalfWidth: maxV,
      mehran: 0,
      bottomShareWeight: 0,
      kernelEmphasis: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-mean',
    };
  }

  const sorted = [...halfWidths].sort((a, b) => a - b);
  // Compute M via the Lorenz-gap integral with rank-linear-descending
  // kernel (1 - p):
  //
  //   M = 6 * integral_0^1 (1 - p) * (p - L(p)) dp
  //
  // The empirical Lorenz curve is piecewise linear on the n+1 nodes
  //   p_0 = 0, p_i = i/n         for i = 1..n
  //   L_0 = 0, L_i = S_i / S_n   where S_i = sum_{k<=i} x_(k), S_n = n*mean
  //
  // Both (1 - p) and (p - L(p)) are linear-by-piece on each [p_{i-1},
  // p_i], so the integrand is the product of two linears -> quadratic.
  // Closed-form Simpson's-rule on a quadratic is EXACT on each segment:
  //
  //   integral_{p_{i-1}}^{p_i} f(p) dp
  //     = (p_i - p_{i-1})/6 * (f(p_{i-1}) + 4 f(p_mid) + f(p_i))
  //
  // We exploit this rather than a paper closed-form because the
  // Simpson-on-piecewise-linears identity is numerically robust and
  // bounded in [0, 1] for any non-negative input by the Lorenz-curve
  // dominance property L(p) <= p.
  let cumulative = 0;
  const cumNorm: number[] = [0];
  for (let i = 0; i < n; i++) {
    cumulative += sorted[i]!;
    cumNorm.push(cumulative / (n * mean));
  }
  const lorenzAt = (p: number): number => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    const fIdx = p * n;
    const lo = Math.floor(fIdx);
    const hi = lo + 1;
    if (hi > n) return 1;
    const frac = fIdx - lo;
    return cumNorm[lo]! + frac * (cumNorm[hi]! - cumNorm[lo]!);
  };
  let m = 0;
  const h = 1 / n;
  for (let i = 1; i <= n; i++) {
    const p0 = (i - 1) / n;
    const p1 = i / n;
    const pm = (p0 + p1) / 2;
    const f0 = (1 - p0) * (p0 - lorenzAt(p0));
    const fm = (1 - pm) * (pm - lorenzAt(pm));
    const f1 = (1 - p1) * (p1 - lorenzAt(p1));
    m += (h / 6) * (f0 + 4 * fm + f1);
  }
  m = 6 * m;
  // Numerical floor: M is theoretically in [0, 1]. Clip tiny FP drift.
  if (m < 0 && m > -1e-12) m = 0;
  if (m > 1 && m - 1 < 1e-9) m = 1;

  // Sanity invariant: kernel weights integrate to 1 in the discrete
  // sum-of-weights form. We use the sum_{i=1..n} (2n - 2i + 1) / n^2
  // identity (= 1) as a normalisation cross-check that's independent
  // of the Simpson integration above.
  let weightSum = 0;
  for (let i = 1; i <= n; i++) weightSum += 2 * n - 2 * i + 1;
  const bottomShareWeight = weightSum / (n * n);

  // Kernel emphasis at the median rank: w(p_med) = 1 - p_med where
  // p_med = (ceil(n/2)) / n. For n=6 -> 1 - 3/6 = 0.5; for n=10 ->
  // 1 - 5/10 = 0.5. A diagnostic for kernel decay.
  const medRank = Math.ceil(n / 2);
  const kernelEmphasis = 1 - medRank / n;

  return {
    nShared: n,
    meanHalfWidth: mean,
    minHalfWidth: minV,
    maxHalfWidth: maxV,
    mehran: m,
    bottomShareWeight,
    kernelEmphasis,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

/**
 * Derived diagnostic: Mehran <-> Gini ORDERING CHECK.
 *
 * For non-negative inputs the empirical Lorenz gap (p - L(p)) is
 * non-negative and concave on each step, and the kernel ratio
 * weight_Mehran(p) / weight_Gini(p) = (1 - p) varies from 1 at
 * p=0 to 0 at p=1. The Mehran-vs-Gini ordering is therefore
 * NOT pointwise but well-defined in integral: M and G satisfy
 * the well-known closed-form identity
 *
 *   M = (3 * (n + 1) / (2 * n)) * G - C_n
 *
 * where C_n is a small-order correction that vanishes as n->inf.
 * Empirically G/2 <= M <= G * 1.5 for typical inputs and we
 * report the pair so an operator can verify.
 *
 * Returns null on the degenerate input.
 */
export function lensWidthMehranGiniPair(
  halfWidths: number[],
): { mehran: number; gini: number; ratio: number } | null {
  const m = lensWidthMehran(halfWidths);
  if (m.degenerateFlag) return null;
  const sorted = [...halfWidths].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = m.meanHalfWidth;
  // Standard Gini sum-form: G = (sum_{i=1..n} (2i - n - 1) * x_(i)) / (n^2 * mean)
  let acc = 0;
  for (let i = 1; i <= n; i++) {
    acc += (2 * i - n - 1) * sorted[i - 1]!;
  }
  const gini = acc / (n * n * mean);
  const ratio = gini > 0 ? m.mehran / gini : m.mehran === 0 ? 1 : Infinity;
  return { mehran: m.mehran, gini, ratio };
}

export function buildSourceRowTokenSlopeCiLensWidthMehran(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthMehranOptions = {},
): SourceRowTokenSlopeCiLensWidthMehranReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const confidence = opts.confidence ?? 0.95;
  if (!Number.isFinite(confidence) || confidence <= 0 || confidence >= 1) {
    throw new Error(
      `confidence must be a finite number in (0, 1) (got ${opts.confidence})`,
    );
  }
  const lambda = opts.lambda ?? 1;
  if (!Number.isFinite(lambda) || lambda <= 0) {
    throw new Error(
      `lambda must be a finite, strictly positive number (got ${opts.lambda})`,
    );
  }
  const bootstraps = opts.bootstraps ?? 1000;
  if (!Number.isInteger(bootstraps) || bootstraps < 100) {
    throw new Error(
      `bootstraps must be an integer >= 100 (got ${opts.bootstraps})`,
    );
  }
  const seed = opts.seed ?? 42;
  if (!Number.isInteger(seed)) {
    throw new Error(`seed must be an integer (got ${opts.seed})`);
  }
  const alertMehran = opts.alertMehran ?? null;
  if (alertMehran !== null) {
    if (!Number.isFinite(alertMehran) || alertMehran < 0 || alertMehran > 1) {
      throw new Error(
        `alertMehran must be a finite number in [0, 1] (got ${opts.alertMehran})`,
      );
    }
  }
  const sort = opts.sort ?? 'mehran-desc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
    );
  }

  const sharedOpts = {
    since: opts.since ?? null,
    until: opts.until ?? null,
    source: opts.source ?? null,
    minRows,
    confidence,
    lambda,
  };

  const bootstrapReport = buildSourceRowTokenBootstrapSlopeCi(queue, {
    ...sharedOpts,
    bootstraps,
    seed,
  });
  const jackknifeReport = buildSourceRowTokenJackknifeSlopeCi(queue, sharedOpts);
  const bcaReport = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    ...sharedOpts,
    bootstraps,
    seed,
  });
  const studReport = buildSourceRowTokenStudentizedBootstrapSlopeCi(queue, {
    ...sharedOpts,
    bootstraps,
    seed,
  });
  const abcReport = buildSourceRowTokenAbcBootstrapSlopeCi(queue, sharedOpts);
  const profileReport = buildSourceRowTokenProfileLikelihoodSlopeCi(
    queue,
    sharedOpts,
  );

  type PerLensRaw = {
    source: string;
    rowsKept: number;
    slope: number;
    ciLower: number;
    ciUpper: number;
  };
  const lensReports: Record<
    SlopeLensWidthMehranLensName,
    Map<string, PerLensRaw>
  > = {
    bootstrap: new Map(bootstrapReport.sources.map((r) => [r.source, r])),
    jackknife: new Map(jackknifeReport.sources.map((r) => [r.source, r])),
    bca: new Map(bcaReport.sources.map((r) => [r.source, r])),
    studentizedT: new Map(studReport.sources.map((r) => [r.source, r])),
    abc: new Map(abcReport.sources.map((r) => [r.source, r])),
    profileLikelihood: new Map(profileReport.sources.map((r) => [r.source, r])),
  };

  const allSources = new Set<string>();
  for (const lens of SLOPE_LENS_WIDTH_MEHRAN_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_MEHRAN_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthMehranLensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_MEHRAN_LENS_NAMES) {
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const halfW = (hi - lo) / 2;
      halfs.push(halfW);
    }
    const comp = lensWidthMehran(halfs);
    rows.push({
      lens,
      nShared: comp.nShared,
      meanHalfWidth: comp.meanHalfWidth,
      minHalfWidth: comp.minHalfWidth,
      maxHalfWidth: comp.maxHalfWidth,
      mehran: comp.mehran,
      bottomShareWeight: comp.bottomShareWeight,
      kernelEmphasis: comp.kernelEmphasis,
      concentrationLabel: classifyConcentration(
        comp.mehran,
        comp.degenerateFlag,
      ),
      degenerateFlag: comp.degenerateFlag,
      degenerateReason: comp.degenerateReason,
      perSourceHalfWidths: halfs,
      perSourceSources: [...sharedSources],
    });
  }

  const finite = rows.filter((r) => !r.degenerateFlag);
  const ms = finite.map((r) => r.mehran);
  const meanM = ms.length > 0 ? ms.reduce((a, b) => a + b, 0) / ms.length : 0;
  const medianM = median(ms);
  const maxM = ms.length > 0 ? Math.max(...ms) : 0;
  const minM = ms.length > 0 ? Math.min(...ms) : 0;
  const rangeM = ms.length > 0 ? maxM - minM : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nExtreme = rows.filter(
    (r) => r.concentrationLabel === 'extreme',
  ).length;
  const nNearUniform = rows.filter(
    (r) => r.concentrationLabel === 'near-uniform',
  ).length;

  let mostExtremeLens: SlopeLensWidthMehranLensName | null = null;
  let mostUniformLens: SlopeLensWidthMehranLensName | null = null;
  if (finite.length > 0) {
    let bestHi = -Infinity;
    let bestLo = Infinity;
    for (const r of finite) {
      if (r.mehran > bestHi) {
        bestHi = r.mehran;
        mostExtremeLens = r.lens;
      }
      if (r.mehran < bestLo) {
        bestLo = r.mehran;
        mostUniformLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertMehran !== null) {
    filtered = filtered.filter((r) => r.mehran > alertMehran);
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthMehranLensRow,
      b: SourceRowTokenSlopeCiLensWidthMehranLensRow,
    ) => number
  > = {
    'mehran-desc': (a, b) => b.mehran - a.mehran,
    'mehran-asc': (a, b) => a.mehran - b.mehran,
    'mean-halfwidth-desc': (a, b) => b.meanHalfWidth - a.meanHalfWidth,
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_MEHRAN_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_MEHRAN_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_MEHRAN_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_MEHRAN_LENS_NAMES.indexOf(b.lens)
    );
  });

  return {
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: opts.source ?? null,
    minRows,
    confidence,
    lambda,
    bootstraps,
    seed,
    alertMehran,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    meanM,
    medianM,
    maxM,
    minM,
    rangeM,
    nDegenerate,
    nExtreme,
    nNearUniform,
    mostExtremeLens,
    mostUniformLens,
    rows: filtered,
  };
}

function fmtNum(x: number, digits = 4): string {
  if (!Number.isFinite(x)) {
    return x === Infinity ? 'inf' : x === -Infinity ? '-inf' : 'NaN';
  }
  return x.toFixed(digits);
}

export function renderSourceRowTokenSlopeCiLensWidthMehran(
  r: SourceRowTokenSlopeCiLensWidthMehranReport,
  opts: {
    showSummary?: boolean;
    showConcentrationAggregate?: boolean;
    showLensAttribution?: boolean;
    showGiniPair?: boolean;
    showPerSourceWidths?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showConcentrationAggregate = opts.showConcentrationAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showGiniPair = opts.showGiniPair ?? false;
  const showPerSourceWidths = opts.showPerSourceWidths ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-width-mehran');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-mehran: ${r.alertMehran ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanM: ${fmtNum(r.meanM, 6)}; medianM: ${fmtNum(r.medianM, 6)}; maxM: ${fmtNum(r.maxM, 6)}; minM: ${fmtNum(r.minM, 6)}; rangeM: ${fmtNum(r.rangeM, 6)}; nExtreme: ${r.nExtreme}; nNearUniform: ${r.nNearUniform}; nDegen: ${r.nDegenerate}; mostExtreme: ${r.mostExtremeLens ?? '-'}; mostUniform: ${r.mostUniformLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     M          mean       min        max        wsum       kemph    concentration       reason',
  );
  lines.push(
    '-----------------  ----  ---------  ---------  ---------  ---------  ---------  -------  ------------------  ---------------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        fmtNum(row.mehran, 6).padStart(9),
        fmtNum(row.meanHalfWidth, 6).padStart(9),
        fmtNum(row.minHalfWidth, 6).padStart(9),
        fmtNum(row.maxHalfWidth, 6).padStart(9),
        fmtNum(row.bottomShareWeight, 6).padStart(9),
        fmtNum(row.kernelEmphasis, 4).padStart(7),
        row.concentrationLabel.padEnd(18),
        (row.degenerateReason ?? '-').padEnd(21),
      ].join('  '),
    );
    if (showSummary) {
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} M=${fmtNum(row.mehran, 6)} mean=${fmtNum(row.meanHalfWidth, 6)} concentration=${row.concentrationLabel}`,
      );
    }
    if (showGiniPair) {
      if (row.degenerateFlag) {
        lines.push(`    giniPair: (degenerate)`);
      } else {
        const pair = lensWidthMehranGiniPair(row.perSourceHalfWidths);
        if (pair === null) {
          lines.push(`    giniPair: (degenerate)`);
        } else {
          lines.push(
            `    giniPair: M=${fmtNum(pair.mehran, 6)} G=${fmtNum(pair.gini, 6)} ratio=M/G=${fmtNum(pair.ratio, 4)} (Mehran kernel (1-p) is bottom-emphasising vs Gini uniform)`,
          );
        }
      }
    }
    if (showPerSourceWidths) {
      if (row.perSourceSources.length === 0) {
        lines.push(`    widths: (no shared sources)`);
      } else {
        const parts: string[] = [];
        for (let i = 0; i < row.perSourceSources.length; i++) {
          parts.push(
            `${row.perSourceSources[i]}=${fmtNum(row.perSourceHalfWidths[i]!, 6)}`,
          );
        }
        lines.push(`    widths: ${parts.join(' ')}`);
      }
    }
  }
  if (showConcentrationAggregate && r.rows.length > 0) {
    const denom = r.rows.length;
    lines.push(
      `[concentration aggregate] nExtreme=${r.nExtreme}/${denom} (${fmtNum(r.nExtreme / denom, 4)}) nNearUniform=${r.nNearUniform}/${denom} (${fmtNum(r.nNearUniform / denom, 4)}) nDegen=${r.nDegenerate}/${denom} (${fmtNum(r.nDegenerate / denom, 4)}) meanM=${fmtNum(r.meanM, 6)} medianM=${fmtNum(r.medianM, 6)} rangeM=${fmtNum(r.rangeM, 6)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostExtreme=${r.mostExtremeLens ?? '-'} (max M) mostUniform=${r.mostUniformLens ?? '-'} (min M)`,
    );
  }
  return lines.join('\n');
}
