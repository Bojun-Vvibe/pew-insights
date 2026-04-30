/**
 * source-row-token-slope-ci-lens-width-atkinson
 *
 * Per-lens CROSS-SOURCE ATKINSON INDEX A(epsilon) of CI half-widths
 * (TWENTY-THIRD cross-lens axis) for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six per-source
 * slope CIs as v0.6.227-v0.6.249 (percentile bootstrap, jackknife
 * normal, BCa, studentized-t, ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL TWENTY-TWO prior cross-lens
 * diagnostics on FOUR orthogonal dimensions, AND in particular
 * distinct from axes 21 (Gini) and 22 (Theil GE(1)) on TWO of those:
 *
 *   1. POPULATION GEOMETRY (vs axes 1-19). Like axes 20-22, this
 *      axis is INDEXED BY LENS (six rows). Axes 1-19 reduce a
 *      6-vector per source to a per-source scalar; this axis
 *      reduces the across-source cloud for each fixed lens to a
 *      single scalar.
 *
 *   2. STATISTIC FAMILY (vs all 1-22). The Atkinson index is a
 *      PARAMETRIC, WELFARE-THEORETIC inequality measure derived
 *      from a constant-relative-risk-aversion (CRRA) social welfare
 *      function with inequality-aversion parameter epsilon > 0.
 *      It is bounded in [0, 1] for ALL n (unlike Theil in [0, ln n]
 *      and Gini in [0, (n-1)/n]) and admits the canonical
 *      "equally-distributed equivalent income" interpretation:
 *      A(eps) = 1 - x_EDE / mu, where x_EDE is the level which,
 *      if shared by all sources, would yield the same social
 *      welfare as the observed distribution. Atkinson is NOT a
 *      Pearson r (axis-20), NOT Gini (axis-21, non-parametric
 *      Lorenz-area), NOT Theil GE(1) (axis-22, fixed entropy
 *      parameter alpha=1).
 *
 *   3. PARAMETRIC FAMILY (vs axes 21 and 22). The Atkinson index
 *      is parameterised by an explicit inequality-aversion
 *      parameter epsilon. We report TWO points on this family
 *      simultaneously: epsilon = 0.5 (mild aversion -- close to
 *      utilitarian) and epsilon = 2 (strong aversion -- close to
 *      Rawlsian, dominated by the worst-off source). This
 *      EXPOSES the parametric structure that is hidden by
 *      Gini (no parameter) and Theil (fixed alpha=1). Two
 *      distributions can have the same Gini and same Theil but
 *      differ in (A(0.5), A(2)) ratios -- the canonical
 *      Pigou-Dalton transfer sensitivity diagnostic.
 *
 *   4. CARDINAL VS ORDINAL EQUALITY-COMPARABILITY (vs all 1-22).
 *      Atkinson admits the welfare-loss interpretation: A(eps)
 *      is the FRACTION of total half-width budget that could be
 *      saved by perfect equalisation while preserving the same
 *      social welfare. Gini and Theil have no such direct
 *      cardinal interpretation in the half-width budget.
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.249. For each lens L:
 *
 *   For each source s in S (sources present in ALL six lens
 *   reports):
 *     halfWidth_{L,s} = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *
 *   Let n = |S|. The Atkinson index A_eps on the n half-widths
 *   x_1, ..., x_n with mean mu = (1/n) sum x_i (Atkinson 1970;
 *   Cowell 2011):
 *
 *     For epsilon != 1:
 *       A(eps) = 1 - ( (1/n) sum_i (x_i / mu)^(1 - eps) )^(1/(1 - eps))
 *
 *     For epsilon = 1 (limit case):
 *       A(1)   = 1 - exp( (1/n) sum_i ln(x_i / mu) )
 *
 *   Equivalently, defining the equally-distributed equivalent
 *   level x_EDE(eps) as
 *     x_EDE(eps != 1) = ( (1/n) sum_i x_i^(1 - eps) )^(1/(1 - eps))
 *     x_EDE(1)        = ( prod_i x_i )^(1/n)   (geometric mean)
 *   we have A(eps) = 1 - x_EDE / mu.
 *
 *   Edge cases:
 *     - n < 3 (fewer than 3 shared sources): A = 0,
 *       degenerateFlag = true, reason = 'too-few-sources'.
 *     - mean = 0 (all half-widths exactly zero -- every CI
 *       collapses to a point): A = 0, degenerateFlag = true,
 *       reason = 'zero-mean-halfwidth'.
 *     - For epsilon >= 1, ANY zero half-width forces x_EDE = 0
 *       and hence A = 1. We surface this as
 *       degenerateFlag = true, reason = 'zero-source-eps-ge-1'
 *       on the eps=2 column (the eps=0.5 column proceeds
 *       normally because (1 - eps) > 0 and 0^(1-eps) = 0 is
 *       finite).
 *     - any half-width is negative or non-finite: throws.
 *
 *   Numerical safety: floating-point can nudge A slightly
 *   outside [0, 1]; the result is clamped to that interval.
 *
 * We report A at TWO epsilon values: eps=0.5 (mild aversion) and
 * eps=2 (strong aversion). Both lie in [0, 1] regardless of n,
 * making them directly comparable across lenses with different
 * shared-source counts (unlike Theil with its ln(n) ceiling).
 *
 * Per-lens columns:
 *   - `lens`            — canonical lens name
 *   - `nShared`         — number of shared sources used
 *   - `meanHalfWidth`   — mean of halfWidth_s across sources
 *   - `minHalfWidth`    — min of halfWidth_s across sources
 *   - `maxHalfWidth`    — max of halfWidth_s across sources
 *   - `atkinsonHalf`    — A(0.5), mild inequality aversion
 *   - `atkinsonTwo`     — A(2), strong inequality aversion
 *   - `xEdeHalf`        — equally-distributed-equivalent level at
 *                          eps=0.5 (= mu * (1 - A(0.5)))
 *   - `xEdeTwo`         — equally-distributed-equivalent level at
 *                          eps=2   (= mu * (1 - A(2)))
 *   - `aversionGap`     — A(2) - A(0.5) >= 0 (Atkinson is
 *                          weakly increasing in eps; gap measures
 *                          how much extra inequality is uncovered
 *                          by stronger aversion -- a sharp
 *                          Pigou-Dalton transfer-sensitivity
 *                          diagnostic)
 *   - `concentrationLabel` — qualitative bin on A(2):
 *                          'highly-concentrated'   (A(2) >  0.5)
 *                          'moderately-concentrated' (A(2) in (0.3, 0.5])
 *                          'mild-concentration'    (A(2) in (0.1, 0.3])
 *                          'near-equal'            (A(2) in [0,   0.1])
 *                          'degenerate'            (degenerateFlagTwo)
 *   - `degenerateFlagHalf` — true iff eps=0.5 hit an edge case
 *   - `degenerateReasonHalf` — reason string for eps=0.5, or null
 *   - `degenerateFlagTwo`  — true iff eps=2 hit an edge case
 *   - `degenerateReasonTwo` — reason string for eps=2, or null
 *
 * Report-level:
 *   - meanAtkinsonHalf      — mean of non-degenerate A(0.5) values
 *   - meanAtkinsonTwo       — mean of non-degenerate A(2) values
 *   - medianAtkinsonHalf    — median of non-degenerate A(0.5) values
 *   - medianAtkinsonTwo     — median of non-degenerate A(2) values
 *   - maxAtkinsonTwo        — max of non-degenerate A(2) values
 *   - minAtkinsonTwo        — min of non-degenerate A(2) values
 *   - rangeAtkinsonTwo      — max - min for A(2)
 *   - meanAversionGap       — mean of (A(2) - A(0.5)) over lenses
 *                              where BOTH eps are non-degenerate
 *   - nDegenerateHalf       — # lenses with degenerateFlagHalf
 *   - nDegenerateTwo        — # lenses with degenerateFlagTwo
 *   - nHighlyConcentrated   — # lenses with A(2) > 0.5
 *   - nNearEqual            — # lenses with A(2) <= 0.1
 *   - mostConcentratedLens  — argmax_L A(2) (canonical tie-break)
 *   - mostEqualLens         — argmin_L A(2) (canonical tie-break)
 *   - largestAversionGapLens — argmax_L (A(2) - A(0.5)) (canonical
 *                               tie-break) -- the lens whose
 *                               inequality is MOST in the tail
 *
 * Filters:
 *   - --alert-atkinson-half <f>  — keep lenses with A(0.5) > f
 *   - --alert-atkinson-two <f>   — keep lenses with A(2)   > f
 *                                    (f in [0, 1])
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_ATKINSON_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthAtkinsonLensName =
  (typeof SLOPE_LENS_WIDTH_ATKINSON_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 3;
const HIGH_THRESHOLD = 0.5;
const MODERATE_THRESHOLD = 0.3;
const NEAR_EQUAL_THRESHOLD = 0.1;
const EPS_HALF = 0.5;
const EPS_TWO = 2;

export type AtkinsonDegenerateReason =
  | 'too-few-sources'
  | 'zero-mean-halfwidth'
  | 'zero-source-eps-ge-1'
  | 'non-finite';

export type AtkinsonConcentrationLabel =
  | 'highly-concentrated'
  | 'moderately-concentrated'
  | 'mild-concentration'
  | 'near-equal'
  | 'degenerate';

export interface SourceRowTokenSlopeCiLensWidthAtkinsonOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertAtkinsonHalf?: number | null;
  alertAtkinsonTwo?: number | null;
  sort?:
    | 'atkinson-two-desc'
    | 'atkinson-two-asc'
    | 'atkinson-half-desc'
    | 'aversion-gap-desc'
    | 'mean-halfwidth-desc'
    | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthAtkinsonLensRow {
  lens: SlopeLensWidthAtkinsonLensName;
  nShared: number;
  meanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  atkinsonHalf: number;
  atkinsonTwo: number;
  xEdeHalf: number;
  xEdeTwo: number;
  aversionGap: number;
  concentrationLabel: AtkinsonConcentrationLabel;
  degenerateFlagHalf: boolean;
  degenerateReasonHalf: AtkinsonDegenerateReason | null;
  degenerateFlagTwo: boolean;
  degenerateReasonTwo: AtkinsonDegenerateReason | null;
  perSourceHalfWidths: number[];
  perSourceSources: string[];
}

export interface SourceRowTokenSlopeCiLensWidthAtkinsonReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertAtkinsonHalf: number | null;
  alertAtkinsonTwo: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiLensWidthAtkinsonOptions['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  meanAtkinsonHalf: number;
  meanAtkinsonTwo: number;
  medianAtkinsonHalf: number;
  medianAtkinsonTwo: number;
  maxAtkinsonTwo: number;
  minAtkinsonTwo: number;
  rangeAtkinsonTwo: number;
  meanAversionGap: number;
  nDegenerateHalf: number;
  nDegenerateTwo: number;
  nHighlyConcentrated: number;
  nNearEqual: number;
  mostConcentratedLens: SlopeLensWidthAtkinsonLensName | null;
  mostEqualLens: SlopeLensWidthAtkinsonLensName | null;
  largestAversionGapLens: SlopeLensWidthAtkinsonLensName | null;
  rows: SourceRowTokenSlopeCiLensWidthAtkinsonLensRow[];
}

const VALID_SORTS = [
  'atkinson-two-desc',
  'atkinson-two-asc',
  'atkinson-half-desc',
  'aversion-gap-desc',
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
  atkinsonTwo: number,
  degenerate: boolean,
): AtkinsonConcentrationLabel {
  if (degenerate) return 'degenerate';
  if (atkinsonTwo > HIGH_THRESHOLD) return 'highly-concentrated';
  if (atkinsonTwo > MODERATE_THRESHOLD) return 'moderately-concentrated';
  if (atkinsonTwo > NEAR_EQUAL_THRESHOLD) return 'mild-concentration';
  return 'near-equal';
}

/**
 * Compute Atkinson A(eps) and the equally-distributed-equivalent
 * level x_EDE on a single set of non-negative half-widths.
 *
 *   A(eps) = 1 - x_EDE(eps) / mean
 *
 *   eps != 1: x_EDE = ( (1/n) sum (x_i / mu)^(1-eps) )^(1/(1-eps)) * mu
 *           = ( (1/n) sum x_i^(1-eps) )^(1/(1-eps))
 *   eps == 1: x_EDE = geometric mean of x_i
 *
 * Returns degenerate metadata for the standard edge cases.
 *
 * Exposed for direct unit-testing.
 */
export function lensWidthAtkinson(
  halfWidths: number[],
  epsilon: number,
): {
  nShared: number;
  meanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  atkinson: number;
  xEde: number;
  degenerateFlag: boolean;
  degenerateReason: AtkinsonDegenerateReason | null;
} {
  if (!Number.isFinite(epsilon) || epsilon <= 0) {
    throw new Error(
      `lensWidthAtkinson: epsilon must be a finite, strictly positive number (got ${epsilon})`,
    );
  }
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthAtkinson: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthAtkinson: halfWidths must be non-negative (got ${v})`,
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
      atkinson: 0,
      xEde: 0,
      degenerateFlag: true,
      degenerateReason: 'too-few-sources',
    };
  }
  let sum = 0;
  let mn = Infinity;
  let mx = -Infinity;
  let nZero = 0;
  for (const v of halfWidths) {
    sum += v;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
    if (v === 0) nZero += 1;
  }
  const mean = sum / n;
  if (mean === 0) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      minHalfWidth: mn,
      maxHalfWidth: mx,
      atkinson: 0,
      xEde: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-mean-halfwidth',
    };
  }
  // For epsilon >= 1, any zero source forces x_EDE = 0 and A = 1.
  if (epsilon >= 1 && nZero > 0) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      minHalfWidth: mn,
      maxHalfWidth: mx,
      atkinson: 1,
      xEde: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-source-eps-ge-1',
    };
  }
  let xEde: number;
  if (epsilon === 1) {
    // Geometric mean (no zeros possible here, handled above).
    let logSum = 0;
    for (const v of halfWidths) {
      logSum += Math.log(v);
    }
    xEde = Math.exp(logSum / n);
  } else {
    // (1/n) sum x_i^(1 - eps), then raise to 1/(1 - eps).
    const oneMinusEps = 1 - epsilon;
    let acc = 0;
    for (const v of halfWidths) {
      // For 0 < eps < 1, oneMinusEps > 0, so 0^(oneMinusEps) = 0 (finite).
      // For eps > 1, oneMinusEps < 0, but we have already returned above
      // if any v == 0, so v > 0 here.
      acc += Math.pow(v, oneMinusEps);
    }
    const moment = acc / n;
    if (moment <= 0 || !Number.isFinite(moment)) {
      return {
        nShared: n,
        meanHalfWidth: mean,
        minHalfWidth: mn,
        maxHalfWidth: mx,
        atkinson: 0,
        xEde: 0,
        degenerateFlag: true,
        degenerateReason: 'non-finite',
      };
    }
    xEde = Math.pow(moment, 1 / oneMinusEps);
  }
  if (!Number.isFinite(xEde)) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      minHalfWidth: mn,
      maxHalfWidth: mx,
      atkinson: 0,
      xEde: 0,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  let atkinson = 1 - xEde / mean;
  // Numerical clamp into [0, 1].
  if (atkinson < 0) atkinson = 0;
  if (atkinson > 1) atkinson = 1;
  return {
    nShared: n,
    meanHalfWidth: mean,
    minHalfWidth: mn,
    maxHalfWidth: mx,
    atkinson,
    xEde,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

export function buildSourceRowTokenSlopeCiLensWidthAtkinson(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthAtkinsonOptions = {},
): SourceRowTokenSlopeCiLensWidthAtkinsonReport {
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
  const alertAtkinsonHalf = opts.alertAtkinsonHalf ?? null;
  if (alertAtkinsonHalf !== null) {
    if (
      !Number.isFinite(alertAtkinsonHalf) ||
      alertAtkinsonHalf < 0 ||
      alertAtkinsonHalf > 1
    ) {
      throw new Error(
        `alertAtkinsonHalf must be a finite number in [0, 1] (got ${opts.alertAtkinsonHalf})`,
      );
    }
  }
  const alertAtkinsonTwo = opts.alertAtkinsonTwo ?? null;
  if (alertAtkinsonTwo !== null) {
    if (
      !Number.isFinite(alertAtkinsonTwo) ||
      alertAtkinsonTwo < 0 ||
      alertAtkinsonTwo > 1
    ) {
      throw new Error(
        `alertAtkinsonTwo must be a finite number in [0, 1] (got ${opts.alertAtkinsonTwo})`,
      );
    }
  }
  const sort = opts.sort ?? 'atkinson-two-desc';
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
    SlopeLensWidthAtkinsonLensName,
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
  for (const lens of SLOPE_LENS_WIDTH_ATKINSON_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_ATKINSON_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthAtkinsonLensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_ATKINSON_LENS_NAMES) {
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const halfW = (hi - lo) / 2;
      halfs.push(halfW);
    }
    const compHalf = lensWidthAtkinson(halfs, EPS_HALF);
    const compTwo = lensWidthAtkinson(halfs, EPS_TWO);
    // Aversion gap: only well-defined when both eps are non-degen.
    let aversionGap = 0;
    if (!compHalf.degenerateFlag && !compTwo.degenerateFlag) {
      aversionGap = compTwo.atkinson - compHalf.atkinson;
      // Atkinson is weakly increasing in eps for non-degenerate
      // distributions; clamp tiny negative floats to 0.
      if (aversionGap < 0) aversionGap = 0;
    }
    const concentrationLabel = classifyConcentration(
      compTwo.atkinson,
      compTwo.degenerateFlag,
    );
    rows.push({
      lens,
      nShared: compHalf.nShared,
      meanHalfWidth: compHalf.meanHalfWidth,
      minHalfWidth: compHalf.minHalfWidth,
      maxHalfWidth: compHalf.maxHalfWidth,
      atkinsonHalf: compHalf.atkinson,
      atkinsonTwo: compTwo.atkinson,
      xEdeHalf: compHalf.xEde,
      xEdeTwo: compTwo.xEde,
      aversionGap,
      concentrationLabel,
      degenerateFlagHalf: compHalf.degenerateFlag,
      degenerateReasonHalf: compHalf.degenerateReason,
      degenerateFlagTwo: compTwo.degenerateFlag,
      degenerateReasonTwo: compTwo.degenerateReason,
      perSourceHalfWidths: halfs,
      perSourceSources: [...sharedSources],
    });
  }

  const nonDegenHalf = rows.filter((r) => !r.degenerateFlagHalf);
  const nonDegenTwo = rows.filter((r) => !r.degenerateFlagTwo);
  const nonDegenBoth = rows.filter(
    (r) => !r.degenerateFlagHalf && !r.degenerateFlagTwo,
  );
  const halfs = nonDegenHalf.map((r) => r.atkinsonHalf);
  const twos = nonDegenTwo.map((r) => r.atkinsonTwo);
  const meanAtkinsonHalf =
    halfs.length > 0 ? halfs.reduce((a, b) => a + b, 0) / halfs.length : 0;
  const meanAtkinsonTwo =
    twos.length > 0 ? twos.reduce((a, b) => a + b, 0) / twos.length : 0;
  const medianAtkinsonHalf = median(halfs);
  const medianAtkinsonTwo = median(twos);
  const maxAtkinsonTwo = twos.length > 0 ? Math.max(...twos) : 0;
  const minAtkinsonTwo = twos.length > 0 ? Math.min(...twos) : 0;
  const rangeAtkinsonTwo = twos.length > 0 ? maxAtkinsonTwo - minAtkinsonTwo : 0;
  const gaps = nonDegenBoth.map((r) => r.aversionGap);
  const meanAversionGap =
    gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const nDegenerateHalf = rows.filter((r) => r.degenerateFlagHalf).length;
  const nDegenerateTwo = rows.filter((r) => r.degenerateFlagTwo).length;
  const nHighlyConcentrated = rows.filter(
    (r) => r.concentrationLabel === 'highly-concentrated',
  ).length;
  const nNearEqual = rows.filter(
    (r) => r.concentrationLabel === 'near-equal',
  ).length;

  let mostConcentratedLens: SlopeLensWidthAtkinsonLensName | null = null;
  let mostEqualLens: SlopeLensWidthAtkinsonLensName | null = null;
  if (nonDegenTwo.length > 0) {
    let bestHi = -Infinity;
    let bestLo = Infinity;
    for (const r of nonDegenTwo) {
      if (r.atkinsonTwo > bestHi) {
        bestHi = r.atkinsonTwo;
        mostConcentratedLens = r.lens;
      }
      if (r.atkinsonTwo < bestLo) {
        bestLo = r.atkinsonTwo;
        mostEqualLens = r.lens;
      }
    }
  }
  let largestAversionGapLens: SlopeLensWidthAtkinsonLensName | null = null;
  if (nonDegenBoth.length > 0) {
    let bestGap = -Infinity;
    for (const r of nonDegenBoth) {
      if (r.aversionGap > bestGap) {
        bestGap = r.aversionGap;
        largestAversionGapLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertAtkinsonHalf !== null) {
    filtered = filtered.filter((r) => r.atkinsonHalf > alertAtkinsonHalf);
  }
  if (alertAtkinsonTwo !== null) {
    filtered = filtered.filter((r) => r.atkinsonTwo > alertAtkinsonTwo);
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthAtkinsonLensRow,
      b: SourceRowTokenSlopeCiLensWidthAtkinsonLensRow,
    ) => number
  > = {
    'atkinson-two-desc': (a, b) => b.atkinsonTwo - a.atkinsonTwo,
    'atkinson-two-asc': (a, b) => a.atkinsonTwo - b.atkinsonTwo,
    'atkinson-half-desc': (a, b) => b.atkinsonHalf - a.atkinsonHalf,
    'aversion-gap-desc': (a, b) => b.aversionGap - a.aversionGap,
    'mean-halfwidth-desc': (a, b) => b.meanHalfWidth - a.meanHalfWidth,
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_ATKINSON_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_ATKINSON_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_ATKINSON_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_ATKINSON_LENS_NAMES.indexOf(b.lens)
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
    alertAtkinsonHalf,
    alertAtkinsonTwo,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    meanAtkinsonHalf,
    meanAtkinsonTwo,
    medianAtkinsonHalf,
    medianAtkinsonTwo,
    maxAtkinsonTwo,
    minAtkinsonTwo,
    rangeAtkinsonTwo,
    meanAversionGap,
    nDegenerateHalf,
    nDegenerateTwo,
    nHighlyConcentrated,
    nNearEqual,
    mostConcentratedLens,
    mostEqualLens,
    largestAversionGapLens,
    rows: filtered,
  };
}

function fmtNum(x: number, digits = 4): string {
  if (!Number.isFinite(x)) {
    return x === Infinity ? 'inf' : x === -Infinity ? '-inf' : 'NaN';
  }
  return x.toFixed(digits);
}

export function renderSourceRowTokenSlopeCiLensWidthAtkinson(
  r: SourceRowTokenSlopeCiLensWidthAtkinsonReport,
  opts: {
    showSummary?: boolean;
    showConcentrationAggregate?: boolean;
    showLensAttribution?: boolean;
    showMoments?: boolean;
    showPerSourceWidths?: boolean;
    showXEde?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showConcentrationAggregate = opts.showConcentrationAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showMoments = opts.showMoments ?? false;
  const showPerSourceWidths = opts.showPerSourceWidths ?? false;
  const showXEde = opts.showXEde ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-width-atkinson');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-atkinson-half: ${r.alertAtkinsonHalf ?? '-'}    alert-atkinson-two: ${r.alertAtkinsonTwo ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanA(0.5): ${fmtNum(r.meanAtkinsonHalf)}; meanA(2): ${fmtNum(r.meanAtkinsonTwo)}; medianA(0.5): ${fmtNum(r.medianAtkinsonHalf)}; medianA(2): ${fmtNum(r.medianAtkinsonTwo)}; maxA(2): ${fmtNum(r.maxAtkinsonTwo)}; minA(2): ${fmtNum(r.minAtkinsonTwo)}; rangeA(2): ${fmtNum(r.rangeAtkinsonTwo)}; meanGap: ${fmtNum(r.meanAversionGap)}; nHighlyConcentrated: ${r.nHighlyConcentrated}; nNearEqual: ${r.nNearEqual}; nDegenHalf: ${r.nDegenerateHalf}; nDegenTwo: ${r.nDegenerateTwo}; mostConcentrated: ${r.mostConcentratedLens ?? '-'}; mostEqual: ${r.mostEqualLens ?? '-'}; largestGap: ${r.largestAversionGapLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     A(0.5)   A(2)     gap      concentration            reasonHalf               reasonTwo',
  );
  lines.push(
    '-----------------  ----  -------  -------  -------  -----------------------  -----------------------  -----------------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        fmtNum(row.atkinsonHalf).padStart(7),
        fmtNum(row.atkinsonTwo).padStart(7),
        fmtNum(row.aversionGap).padStart(7),
        row.concentrationLabel.padEnd(23),
        (row.degenerateReasonHalf ?? '-').padEnd(23),
        (row.degenerateReasonTwo ?? '-').padEnd(23),
      ].join('  '),
    );
    if (showSummary) {
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} A(0.5)=${fmtNum(row.atkinsonHalf)} A(2)=${fmtNum(row.atkinsonTwo)} gap=${fmtNum(row.aversionGap)} concentration=${row.concentrationLabel}`,
      );
    }
    if (showMoments) {
      lines.push(
        `    moments: meanHalf=${fmtNum(row.meanHalfWidth, 6)} minHalf=${fmtNum(row.minHalfWidth, 6)} maxHalf=${fmtNum(row.maxHalfWidth, 6)}`,
      );
    }
    if (showXEde) {
      lines.push(
        `    xEde: xEde(0.5)=${fmtNum(row.xEdeHalf, 6)} xEde(2)=${fmtNum(row.xEdeTwo, 6)} (mean=${fmtNum(row.meanHalfWidth, 6)})`,
      );
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
      `[concentration aggregate] nHighlyConcentrated=${r.nHighlyConcentrated}/${denom} (${fmtNum(r.nHighlyConcentrated / denom, 4)}) nNearEqual=${r.nNearEqual}/${denom} (${fmtNum(r.nNearEqual / denom, 4)}) nDegenHalf=${r.nDegenerateHalf}/${denom} (${fmtNum(r.nDegenerateHalf / denom, 4)}) nDegenTwo=${r.nDegenerateTwo}/${denom} (${fmtNum(r.nDegenerateTwo / denom, 4)}) meanA(0.5)=${fmtNum(r.meanAtkinsonHalf)} meanA(2)=${fmtNum(r.meanAtkinsonTwo)} meanGap=${fmtNum(r.meanAversionGap)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostConcentrated=${r.mostConcentratedLens ?? '-'} (max A(2)) mostEqual=${r.mostEqualLens ?? '-'} (min A(2)) largestAversionGap=${r.largestAversionGapLens ?? '-'} (max A(2)-A(0.5))`,
    );
  }
  return lines.join('\n');
}
