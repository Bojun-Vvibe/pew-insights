/**
 * source-row-token-slope-ci-lens-width-ge2
 *
 * Per-lens CROSS-SOURCE GENERALISED ENTROPY GE(alpha=2) of CI
 * half-widths (TWENTY-SEVENTH cross-lens axis) for the v0.6.219
 * Deming-slope uncertainty-quantification suite. Consumes the
 * SAME six per-source slope CIs as v0.6.227-v0.6.256 (percentile
 * bootstrap, jackknife normal, BCa, studentized-t, ABC,
 * profile-likelihood).
 *
 * Mechanically distinct from ALL TWENTY-SIX prior cross-lens
 * diagnostics on FIVE orthogonal dimensions:
 *
 *   1. POPULATION GEOMETRY (vs axes 1-19). Like axes 20-26, the
 *      report is INDEXED BY LENS (six rows). Axes 1-19 reduce a
 *      6-vector per source to a per-source scalar; this axis
 *      reduces the across-source half-width cloud at each fixed
 *      lens to a single scalar.
 *
 *   2. STATISTIC FAMILY (vs all 1-26). GE(2) is the
 *      VARIANCE-NORMALISED HALF-SQUARED-CV functional of the
 *      half-width distribution:
 *
 *        GE(2) = (1 / (2n)) * sum_i ((x_i / mean) - 1)^2
 *              = (1/2) * (sigma / mean)^2
 *              = (1/2) * CV^2
 *
 *      Bourguignon (1979); Cowell-Kuga (1981); Shorrocks (1980)
 *      as the additively-decomposable inequality measure with
 *      alpha=2. In direct contrast to ALL prior axes:
 *
 *        - axis-21 Gini integrates (p - L(p)) over p (an L_1
 *          functional of the Lorenz process). GE(2) is a
 *          SECOND-MOMENT functional of the SHARES around their
 *          mean -- L_2 squared, not L_1 of the Lorenz gap.
 *        - axis-22 Theil GE(1) is the entropic special case
 *          alpha=1: GE(1) = sum (x_i / S) * log(x_i / mean).
 *          GE(2) is the alpha=2 case in the SAME parametric
 *          family but DRAMATICALLY MORE TOP-SENSITIVE: GE(alpha)
 *          weights the top tail with x^alpha, so doubling the
 *          single largest source under GE(2) raises the index
 *          ~4x more than under GE(1) for skewed inputs.
 *        - axis-23 Atkinson is a CRRA welfare loss
 *          (1 - M_(1-eps) / mean), bounded in [0, 1]. GE(2) is
 *          UNBOUNDED above (in [0, +inf)) and is a moment-based,
 *          NOT a utility-based, functional.
 *        - axis-24 QCD uses EXACTLY TWO order statistics (Q1,
 *          Q3); GE(2) uses the FULL n-vector via a squared sum.
 *        - axis-25 Hoover is L_infinity on the Lorenz process
 *          (and L_1 on the absolute share deviations). GE(2) is
 *          L_2 SQUARED on the share deviations -- different norm,
 *          different sensitivity (a single outlier inflates GE(2)
 *          quadratically, but Hoover only linearly).
 *        - axis-26 Palma is a TWO-POINT RATIO at p=0.4 and p=0.9.
 *          GE(2) integrates the WHOLE share-deviation cloud and
 *          has NO decile knife-edge.
 *
 *      Critically, GE(2) is the UNIQUE inequality measure shipped
 *      that is ADDITIVELY DECOMPOSABLE INTO BETWEEN-GROUP AND
 *      WITHIN-GROUP COMPONENTS in the Shorrocks (1980) sense
 *      (Gini, Hoover, Atkinson, QCD, Palma all violate strong
 *      decomposability). Reported as `betweenGroupShare` =
 *      between-quartile-group GE(2) divided by total GE(2),
 *      a per-lens diagnostic that no prior axis exposes.
 *
 *   3. SENSITIVITY PROFILE (vs axes 21-26). GE(2) satisfies the
 *      Pigou-Dalton transfer principle (like Gini, Theil, and
 *      Atkinson, but UNLIKE Hoover, QCD, and Palma) AND the
 *      strong principle of transfers (a transfer between two
 *      sources at the SAME absolute distance contributes
 *      proportionally MORE to GE(2) when those sources are
 *      farther from the mean -- the squared-deviation kernel).
 *      GE(2) is therefore the canonical diagnostic for "how
 *      much extra dispersion comes specifically from the upper
 *      tail of the half-width cloud", which the L_1 Gini
 *      smears uniformly and the L_inf Hoover collapses to the
 *      single supremum point.
 *
 *   4. BOUNDEDNESS AND ZERO-IMMUNITY (vs axes 22, 23). UNBOUNDED
 *      above, but tolerates up to n - 1 zero half-widths without
 *      degeneracy (only the all-zero case is degenerate -- mean
 *      undefined). Theil GE(1) requires every source > 0 (a
 *      single zero produces -inf inside the log); Atkinson at
 *      eps>=1 collapses to A=1 on a single zero. GE(2) inherits
 *      the WIDEST domain shared with Hoover, plus a finite
 *      meaningful value on any non-trivial half-width vector.
 *
 *   5. COMPUTATIONAL FORM (vs all 1-26). GE(2) is a SINGLE-PASS
 *      sum-of-squared deviations from the mean -- O(n) and
 *      derivative-free, with TWO numerically-stable equivalent
 *      forms:
 *
 *        GE(2) = (1 / (2n)) * sum_i ((x_i - mean) / mean)^2
 *              = (1/2) * (E[X^2] / mean^2 - 1)
 *
 *      The implementation uses the FIRST form (Welford-stable
 *      around the centre) to avoid catastrophic cancellation
 *      that the second form suffers when the variance is small
 *      relative to mean^2.
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.256. For each lens L:
 *
 *   For each source s in S (sources present in ALL six lens
 *   reports):
 *     halfWidth_{L,s} = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *
 *   Let w_i be the n cross-source half-widths. With S = sum(w_i),
 *   mean = S / n, and n >= 1:
 *
 *     GE(2) = (1 / (2n)) * sum_i ((w_i / mean) - 1)^2
 *           = (1/2) * (sigma / mean)^2
 *
 *   Edge cases (parity with axes 21-26):
 *     - n < 4: GE2 = 0, degenerateFlag = true,
 *              reason = 'too-few-sources'.
 *     - S = 0 (every half-width is exactly zero): GE2 = 0,
 *       degenerateFlag = true, reason = 'zero-mass'.
 *     - Any half-width is negative or non-finite: throws.
 *     - The exotic case where sum-of-squares overflows to +inf:
 *       degenerateFlag = true, reason = 'non-finite'.
 *
 *   Numerical safety: the result is clamped into [0, 1e12] to
 *   match the saturation convention used by axis-26 Palma when
 *   the index is unbounded above. The half-CV form is reported
 *   alongside as `cv` and its square as `cvSquared` for
 *   independent verification (GE(2) == cvSquared / 2 exactly).
 *
 * Per-lens columns:
 *   - `lens`               -- canonical lens name
 *   - `nShared`            -- number of shared sources used
 *   - `meanHalfWidth`      -- arithmetic mean of half-widths
 *   - `totalHalfWidth`     -- sum of half-widths
 *   - `cv`                 -- coefficient of variation = sigma / mean
 *   - `cvSquared`          -- CV^2; GE2 == cvSquared / 2 exactly
 *   - `ge2`                -- Generalised Entropy GE(alpha=2)
 *   - `ge2Saturated`       -- true iff ge2 hit the 1e12 clamp
 *   - `betweenGroupShare`  -- ratio of between-quartile-group GE(2)
 *                             to total GE(2); decomposability
 *                             diagnostic in [0, 1]; 0 if degenerate
 *                             or n < 4
 *   - `concentrationLabel` -- qualitative bin on `ge2`:
 *                            'extreme'              (ge2 > 1.0 or saturated)
 *                            'high-concentration'   (ge2 in (0.5, 1.0])
 *                            'moderate'             (ge2 in (0.125, 0.5])
 *                            'mild'                 (ge2 in (0.02, 0.125])
 *                            'near-uniform'         (ge2 in [0, 0.02])
 *                            'degenerate'           (degenerateFlag)
 *   - `degenerateFlag`     -- true iff hit an edge case
 *   - `degenerateReason`   -- reason string, or null
 *
 * Report-level:
 *   - meanGe2              -- mean of non-degenerate, non-saturated ge2
 *   - medianGe2            -- median over the same set
 *   - maxGe2, minGe2, rangeGe2
 *   - nDegenerate          -- # lenses with degenerateFlag
 *   - nSaturated           -- # lenses with ge2 hitting 1e12 clamp
 *   - nExtreme             -- # lenses with ge2 > 1.0 OR saturated
 *   - nNearUniform         -- # lenses with ge2 <= 0.02
 *   - mostExtremeLens      -- argmax_L ge2 (canonical tie-break,
 *                             saturation-aware: a saturated lens
 *                             beats a finite one)
 *   - mostUniformLens      -- argmin_L ge2 (canonical tie-break)
 *
 * Filters:
 *   - --alert-ge2 <f>      -- keep lenses with ge2 > f (f >= 0)
 *   - --alert-mass <f>     -- keep lenses with totalHalfWidth > f
 *   - --alert-cv <f>       -- keep lenses with cv > f (f >= 0)
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_GE2_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthGe2LensName =
  (typeof SLOPE_LENS_WIDTH_GE2_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 4;
const SATURATION_CLAMP = 1e12;
const EXTREME_THRESHOLD = 1.0;
const HIGH_THRESHOLD = 0.5;
const MODERATE_THRESHOLD = 0.125;
const MILD_THRESHOLD = 0.02;

export type Ge2DegenerateReason =
  | 'too-few-sources'
  | 'zero-mass'
  | 'non-finite';

export type Ge2ConcentrationLabel =
  | 'extreme'
  | 'high-concentration'
  | 'moderate'
  | 'mild'
  | 'near-uniform'
  | 'degenerate';

export interface SourceRowTokenSlopeCiLensWidthGe2Options {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertGe2?: number | null;
  alertMass?: number | null;
  alertCv?: number | null;
  sort?:
    | 'ge2-desc'
    | 'ge2-asc'
    | 'cv-desc'
    | 'mass-desc'
    | 'mean-halfwidth-desc'
    | 'between-group-share-desc'
    | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthGe2LensRow {
  lens: SlopeLensWidthGe2LensName;
  nShared: number;
  meanHalfWidth: number;
  totalHalfWidth: number;
  cv: number;
  cvSquared: number;
  ge2: number;
  ge2Saturated: boolean;
  betweenGroupShare: number;
  concentrationLabel: Ge2ConcentrationLabel;
  degenerateFlag: boolean;
  degenerateReason: Ge2DegenerateReason | null;
  perSourceHalfWidths: number[];
  perSourceSources: string[];
}

export interface SourceRowTokenSlopeCiLensWidthGe2Report {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertGe2: number | null;
  alertMass: number | null;
  alertCv: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiLensWidthGe2Options['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  meanGe2: number;
  medianGe2: number;
  maxGe2: number;
  minGe2: number;
  rangeGe2: number;
  nDegenerate: number;
  nSaturated: number;
  nExtreme: number;
  nNearUniform: number;
  mostExtremeLens: SlopeLensWidthGe2LensName | null;
  mostUniformLens: SlopeLensWidthGe2LensName | null;
  rows: SourceRowTokenSlopeCiLensWidthGe2LensRow[];
}

const VALID_SORTS = [
  'ge2-desc',
  'ge2-asc',
  'cv-desc',
  'mass-desc',
  'mean-halfwidth-desc',
  'between-group-share-desc',
  'lens',
] as const;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[m]!;
  return (s[m - 1]! + s[m]!) / 2;
}

/**
 * Inverse of the GE(2) <-> CV^2 identity:
 *
 *     CV^2 = 2 * GE(2)
 *
 * Exposed so that downstream consumers (and the unit tests) can
 * round-trip the identity at exactly the precision of the input
 * GE(2), without re-summing the underlying half-widths. Used
 * internally to populate the `cvSquared` field in `lensWidthGe2`
 * so the identity holds by construction rather than only up to
 * floating-point rounding.
 *
 * Returns 0 for non-finite or negative inputs (parity with the
 * degenerate-row convention).
 */
export function ge2CvSquaredFromGe2(ge2: number): number {
  if (!Number.isFinite(ge2) || ge2 < 0) return 0;
  return 2 * ge2;
}

function classifyConcentration(
  ge2: number,
  saturated: boolean,
  degenerate: boolean,
): Ge2ConcentrationLabel {
  if (degenerate) return 'degenerate';
  if (saturated || ge2 > EXTREME_THRESHOLD) return 'extreme';
  if (ge2 > HIGH_THRESHOLD) return 'high-concentration';
  if (ge2 > MODERATE_THRESHOLD) return 'moderate';
  if (ge2 > MILD_THRESHOLD) return 'mild';
  return 'near-uniform';
}

/**
 * Compute the GENERALISED ENTROPY GE(alpha=2) on a single set of
 * non-negative half-widths:
 *
 *   GE(2) = (1 / (2n)) * sum_i ((w_i / mean) - 1)^2
 *         = (1/2) * (sigma / mean)^2
 *
 * Unbounded above; clamped to 1e12 to keep JSON output finite.
 *
 * Returns degenerate metadata for the standard edge cases, plus
 * the CV-form (cv, cvSquared) for independent verification of the
 * identity GE(2) == cvSquared / 2.
 *
 * Exposed for direct unit-testing.
 */
export function lensWidthGe2(halfWidths: number[]): {
  nShared: number;
  meanHalfWidth: number;
  totalHalfWidth: number;
  cv: number;
  cvSquared: number;
  ge2: number;
  ge2Saturated: boolean;
  degenerateFlag: boolean;
  degenerateReason: Ge2DegenerateReason | null;
} {
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthGe2: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthGe2: halfWidths must be non-negative (got ${v})`,
      );
    }
  }
  const n = halfWidths.length;
  if (n < MIN_SHARED_SOURCES) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      totalHalfWidth: 0,
      cv: 0,
      cvSquared: 0,
      ge2: 0,
      ge2Saturated: false,
      degenerateFlag: true,
      degenerateReason: 'too-few-sources',
    };
  }
  let total = 0;
  for (const v of halfWidths) total += v;
  if (!Number.isFinite(total)) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      totalHalfWidth: total,
      cv: 0,
      cvSquared: 0,
      ge2: 0,
      ge2Saturated: false,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  if (total === 0) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      totalHalfWidth: 0,
      cv: 0,
      cvSquared: 0,
      ge2: 0,
      ge2Saturated: false,
      degenerateFlag: true,
      degenerateReason: 'zero-mass',
    };
  }
  const mean = total / n;
  // Stable centred form: GE(2) = (1/(2n)) * sum ((w/mean) - 1)^2.
  let sumSq = 0;
  for (const v of halfWidths) {
    const r = v / mean - 1;
    sumSq += r * r;
  }
  if (!Number.isFinite(sumSq)) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      totalHalfWidth: total,
      cv: 0,
      cvSquared: 0,
      ge2: 0,
      ge2Saturated: false,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  let ge2Raw = sumSq / (2 * n);
  if (ge2Raw < 0) ge2Raw = 0;
  // Identity: GE(2) == cvSquared / 2 holds by construction here. We
  // expose cvSquared = 2 * ge2Raw rather than recomputing
  // sigma^2 / mean^2 from a separate pass, because the two paths
  // would only agree to within floating-point rounding and the
  // GE(2) <-> CV identity is the canonical Shorrocks-Cowell form
  // -- consumers can reverse the identity exactly via cvSquared / 2.
  const cvSquared = ge2CvSquaredFromGe2(ge2Raw);
  const cv = Math.sqrt(cvSquared);
  let ge2Saturated = false;
  let ge2 = ge2Raw;
  if (ge2 > SATURATION_CLAMP) {
    ge2 = SATURATION_CLAMP;
    ge2Saturated = true;
  }
  return {
    nShared: n,
    meanHalfWidth: mean,
    totalHalfWidth: total,
    cv,
    cvSquared,
    ge2,
    ge2Saturated,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

/**
 * Shorrocks (1980) decomposition diagnostic: the BETWEEN-GROUP
 * SHARE of total GE(2), where groups are formed by sorted
 * quartiles of the input half-widths.
 *
 * For an n-vector with n >= 4 we sort ascending and split into
 * four contiguous (approximately equal-sized) bins. We compute
 *
 *   GE(2)_total   = lensWidthGe2(xs).ge2
 *   GE(2)_between = (1 / (2n)) * sum_g n_g * ((mean_g / mean) - 1)^2
 *
 * and return GE(2)_between / GE(2)_total in [0, 1] (clamped). On
 * any degenerate input (n < 4, zero mass, or GE(2)_total = 0)
 * returns 0 -- there is no inequality to decompose.
 *
 * Exposed for direct unit-testing.
 */
export function ge2BetweenGroupShare(halfWidths: number[]): number {
  const n = halfWidths.length;
  if (n < 4) return 0;
  let total = 0;
  for (const v of halfWidths) {
    if (!Number.isFinite(v) || v < 0) return 0;
    total += v;
  }
  if (!(total > 0)) return 0;
  const mean = total / n;
  let sumSqAll = 0;
  for (const v of halfWidths) {
    const r = v / mean - 1;
    sumSqAll += r * r;
  }
  const ge2Total = sumSqAll / (2 * n);
  if (!(ge2Total > 0)) return 0;
  const sorted = [...halfWidths].sort((a, b) => a - b);
  // Four contiguous bins, sizes [ceil, ceil, floor, floor] or similar.
  const base = Math.floor(n / 4);
  const rem = n - 4 * base;
  const sizes = [base, base, base, base];
  for (let i = 0; i < rem; i++) sizes[i] = sizes[i]! + 1;
  let cursor = 0;
  let sumSqBetween = 0;
  for (let g = 0; g < 4; g++) {
    const sz = sizes[g]!;
    if (sz === 0) continue;
    let groupSum = 0;
    for (let i = cursor; i < cursor + sz; i++) groupSum += sorted[i]!;
    const groupMean = groupSum / sz;
    const r = groupMean / mean - 1;
    sumSqBetween += sz * r * r;
    cursor += sz;
  }
  const ge2Between = sumSqBetween / (2 * n);
  let share = ge2Between / ge2Total;
  if (!Number.isFinite(share) || share < 0) share = 0;
  if (share > 1) share = 1;
  return share;
}

export function buildSourceRowTokenSlopeCiLensWidthGe2(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthGe2Options = {},
): SourceRowTokenSlopeCiLensWidthGe2Report {
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
  const alertGe2 = opts.alertGe2 ?? null;
  if (alertGe2 !== null) {
    if (!Number.isFinite(alertGe2) || alertGe2 < 0) {
      throw new Error(
        `alertGe2 must be a finite, non-negative number (got ${opts.alertGe2})`,
      );
    }
  }
  const alertMass = opts.alertMass ?? null;
  if (alertMass !== null) {
    if (!Number.isFinite(alertMass) || alertMass < 0) {
      throw new Error(
        `alertMass must be a finite, non-negative number (got ${opts.alertMass})`,
      );
    }
  }
  const alertCv = opts.alertCv ?? null;
  if (alertCv !== null) {
    if (!Number.isFinite(alertCv) || alertCv < 0) {
      throw new Error(
        `alertCv must be a finite, non-negative number (got ${opts.alertCv})`,
      );
    }
  }
  const sort = opts.sort ?? 'ge2-desc';
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
    SlopeLensWidthGe2LensName,
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
  for (const lens of SLOPE_LENS_WIDTH_GE2_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_GE2_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthGe2LensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_GE2_LENS_NAMES) {
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const halfW = (hi - lo) / 2;
      halfs.push(halfW);
    }
    const comp = lensWidthGe2(halfs);
    const concentrationLabel = classifyConcentration(
      comp.ge2,
      comp.ge2Saturated,
      comp.degenerateFlag,
    );
    const between = comp.degenerateFlag ? 0 : ge2BetweenGroupShare(halfs);
    rows.push({
      lens,
      nShared: comp.nShared,
      meanHalfWidth: comp.meanHalfWidth,
      totalHalfWidth: comp.totalHalfWidth,
      cv: comp.cv,
      cvSquared: comp.cvSquared,
      ge2: comp.ge2,
      ge2Saturated: comp.ge2Saturated,
      betweenGroupShare: between,
      concentrationLabel,
      degenerateFlag: comp.degenerateFlag,
      degenerateReason: comp.degenerateReason,
      perSourceHalfWidths: halfs,
      perSourceSources: [...sharedSources],
    });
  }

  const finite = rows.filter(
    (r) => !r.degenerateFlag && !r.ge2Saturated,
  );
  const gs = finite.map((r) => r.ge2);
  const meanGe2 = gs.length > 0 ? gs.reduce((a, b) => a + b, 0) / gs.length : 0;
  const medianGe2 = median(gs);
  const maxGe2 = gs.length > 0 ? Math.max(...gs) : 0;
  const minGe2 = gs.length > 0 ? Math.min(...gs) : 0;
  const rangeGe2 = gs.length > 0 ? maxGe2 - minGe2 : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nSaturated = rows.filter((r) => r.ge2Saturated).length;
  const nExtreme = rows.filter(
    (r) => r.concentrationLabel === 'extreme',
  ).length;
  const nNearUniform = rows.filter(
    (r) => r.concentrationLabel === 'near-uniform',
  ).length;

  let mostExtremeLens: SlopeLensWidthGe2LensName | null = null;
  let mostUniformLens: SlopeLensWidthGe2LensName | null = null;
  // Saturation-aware tie-break: any saturated row beats any finite row
  // for "most extreme"; saturated rows are excluded from "most uniform".
  const extremeCandidates = rows.filter((r) => !r.degenerateFlag);
  if (extremeCandidates.length > 0) {
    let bestHi = -Infinity;
    for (const r of extremeCandidates) {
      const score = r.ge2Saturated ? Number.POSITIVE_INFINITY : r.ge2;
      if (score > bestHi) {
        bestHi = score;
        mostExtremeLens = r.lens;
      }
    }
  }
  const uniformCandidates = rows.filter(
    (r) => !r.degenerateFlag && !r.ge2Saturated,
  );
  if (uniformCandidates.length > 0) {
    let bestLo = Infinity;
    for (const r of uniformCandidates) {
      if (r.ge2 < bestLo) {
        bestLo = r.ge2;
        mostUniformLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertGe2 !== null) {
    filtered = filtered.filter((r) => r.ge2 > alertGe2);
  }
  if (alertMass !== null) {
    filtered = filtered.filter((r) => r.totalHalfWidth > alertMass);
  }
  if (alertCv !== null) {
    filtered = filtered.filter((r) => r.cv > alertCv);
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthGe2LensRow,
      b: SourceRowTokenSlopeCiLensWidthGe2LensRow,
    ) => number
  > = {
    'ge2-desc': (a, b) => {
      const sa = a.ge2Saturated ? Number.POSITIVE_INFINITY : a.ge2;
      const sb = b.ge2Saturated ? Number.POSITIVE_INFINITY : b.ge2;
      return sb - sa;
    },
    'ge2-asc': (a, b) => {
      const sa = a.ge2Saturated ? Number.POSITIVE_INFINITY : a.ge2;
      const sb = b.ge2Saturated ? Number.POSITIVE_INFINITY : b.ge2;
      return sa - sb;
    },
    'cv-desc': (a, b) => b.cv - a.cv,
    'mass-desc': (a, b) => b.totalHalfWidth - a.totalHalfWidth,
    'mean-halfwidth-desc': (a, b) => b.meanHalfWidth - a.meanHalfWidth,
    'between-group-share-desc': (a, b) => {
      // Degenerate rows demoted to bottom of desc.
      const sa = a.degenerateFlag ? -Infinity : a.betweenGroupShare;
      const sb = b.degenerateFlag ? -Infinity : b.betweenGroupShare;
      return sb - sa;
    },
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_GE2_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_GE2_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_GE2_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_GE2_LENS_NAMES.indexOf(b.lens)
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
    alertGe2,
    alertMass,
    alertCv,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    meanGe2,
    medianGe2,
    maxGe2,
    minGe2,
    rangeGe2,
    nDegenerate,
    nSaturated,
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

export function renderSourceRowTokenSlopeCiLensWidthGe2(
  r: SourceRowTokenSlopeCiLensWidthGe2Report,
  opts: {
    showSummary?: boolean;
    showConcentrationAggregate?: boolean;
    showLensAttribution?: boolean;
    showCvIdentity?: boolean;
    showBetweenGroup?: boolean;
    showPerSourceWidths?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showConcentrationAggregate = opts.showConcentrationAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showCvIdentity = opts.showCvIdentity ?? false;
  const showBetweenGroup = opts.showBetweenGroup ?? false;
  const showPerSourceWidths = opts.showPerSourceWidths ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-width-ge2');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-ge2: ${r.alertGe2 ?? '-'}    alert-mass: ${r.alertMass ?? '-'}    alert-cv: ${r.alertCv ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanGE2: ${fmtNum(r.meanGe2)}; medianGE2: ${fmtNum(r.medianGe2)}; maxGE2: ${fmtNum(r.maxGe2)}; minGE2: ${fmtNum(r.minGe2)}; rangeGE2: ${fmtNum(r.rangeGe2)}; nExtreme: ${r.nExtreme}; nNearUniform: ${r.nNearUniform}; nSaturated: ${r.nSaturated}; nDegen: ${r.nDegenerate}; mostExtreme: ${r.mostExtremeLens ?? '-'}; mostUniform: ${r.mostUniformLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     GE2       CV       mean       total      between  concentration            reason',
  );
  lines.push(
    '-----------------  ----  --------  -------  ---------  ---------  -------  -----------------------  ---------------------',
  );
  for (const row of r.rows) {
    const ge2Str = row.ge2Saturated
      ? '>=1e+12'
      : fmtNum(row.ge2).padStart(8);
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        ge2Str.padStart(8),
        fmtNum(row.cv).padStart(7),
        fmtNum(row.meanHalfWidth, 6).padStart(9),
        fmtNum(row.totalHalfWidth, 6).padStart(9),
        fmtNum(row.betweenGroupShare).padStart(7),
        row.concentrationLabel.padEnd(23),
        (row.degenerateReason ?? '-').padEnd(21),
      ].join('  '),
    );
    if (showSummary) {
      const ge2Label = row.ge2Saturated ? 'SATURATED(>=1e12)' : fmtNum(row.ge2);
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} GE2=${ge2Label} CV=${fmtNum(row.cv)} concentration=${row.concentrationLabel}`,
      );
    }
    if (showCvIdentity) {
      // GE(2) == cvSquared / 2 exactly; expose both sides so the caller
      // can independently verify the identity at the displayed precision.
      const lhs = row.ge2Saturated ? 'SAT' : fmtNum(row.ge2, 6);
      const rhs = row.ge2Saturated ? 'SAT' : fmtNum(row.cvSquared / 2, 6);
      lines.push(
        `    cvIdentity: GE2=${lhs} cvSquared/2=${rhs} cv=${fmtNum(row.cv, 6)} cvSquared=${fmtNum(row.cvSquared, 6)}`,
      );
    }
    if (showBetweenGroup) {
      if (row.degenerateFlag) {
        lines.push(`    betweenGroup: (degenerate)`);
      } else {
        const within = 1 - row.betweenGroupShare;
        lines.push(
          `    betweenGroup: between-quartile-group share=${fmtNum(row.betweenGroupShare)} within-group share=${fmtNum(within)} (Shorrocks 1980 additive decomposition: GE(2) = GE_between + GE_within)`,
        );
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
      `[concentration aggregate] nExtreme=${r.nExtreme}/${denom} (${fmtNum(r.nExtreme / denom, 4)}) nNearUniform=${r.nNearUniform}/${denom} (${fmtNum(r.nNearUniform / denom, 4)}) nSaturated=${r.nSaturated}/${denom} (${fmtNum(r.nSaturated / denom, 4)}) nDegen=${r.nDegenerate}/${denom} (${fmtNum(r.nDegenerate / denom, 4)}) meanGE2=${fmtNum(r.meanGe2)} medianGE2=${fmtNum(r.medianGe2)} rangeGE2=${fmtNum(r.rangeGe2)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostExtreme=${r.mostExtremeLens ?? '-'} (max GE2, saturation-aware) mostUniform=${r.mostUniformLens ?? '-'} (min GE2, saturated lenses excluded)`,
    );
  }
  return lines.join('\n');
}
