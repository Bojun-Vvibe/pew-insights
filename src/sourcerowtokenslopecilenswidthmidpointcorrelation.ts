/**
 * source-row-token-slope-ci-lens-width-midpoint-correlation
 *
 * Per-lens CROSS-SOURCE PEARSON CORRELATION between CI half-width
 * and CI midpoint magnitude (TWENTIETH cross-lens axis) for the
 * v0.6.219 Deming-slope uncertainty-quantification suite. Consumes
 * the SAME six per-source slope CIs as v0.6.227-v0.6.246
 * (percentile bootstrap, jackknife normal, BCa, studentized-t,
 * ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL NINETEEN prior cross-lens
 * diagnostics on TWO independent dimensions:
 *
 *   1. POPULATION GEOMETRY (the dominant axis of orthogonality).
 *      ALL nineteen prior cross-lens diagnostics are PER-SOURCE
 *      reductions across the SIX lenses: for each source you take
 *      a 6-vector (midpoints, half-widths, ranks, ...) and reduce
 *      it to a per-source scalar (entropy, variance, log-ratio
 *      variance, curvature, asymmetry, ...). The population of
 *      report rows is sources, indexed by source id.
 *
 *      THIS AXIS INVERTS THE GEOMETRY. For each LENS L in the six,
 *      we collect the across-source cloud of (midpoint_s, half-
 *      width_s) pairs and reduce it to a single scalar — the
 *      Pearson correlation between |midpoint| and half-width across
 *      the source population. The population of report rows is
 *      LENSES (six rows), not sources. Per-source statistics are
 *      surfaced only as inputs (they're already covered by axes
 *      1-19); the new diagnostic lives entirely in the cross-source
 *      population for each fixed lens.
 *
 *      No prior axis touches this geometry. Axes 1-19 are blind to
 *      the across-source distribution of (midpoint, half-width)
 *      pairs for a fixed lens: they reduce within a source first,
 *      then aggregate across sources only as report-level summary
 *      statistics (means, medians, mode counts) of the per-source
 *      scalar. Axis-20 is the first to compute a non-trivial
 *      cross-source statistic conditional on a fixed lens.
 *
 *   2. STATISTIC FAMILY. This is a HETEROSCEDASTICITY diagnostic:
 *      for a given lens, do sources with larger absolute slope
 *      systematically receive wider CIs (positive correlation,
 *      classical multiplicative noise) or narrower CIs (negative
 *      correlation, anti-heteroscedastic / pathological)? A purely
 *      additive-noise lens would yield Pearson r ~ 0; a purely
 *      multiplicative-noise lens would yield Pearson r ~ +1 (CI
 *      half-width proportional to |slope|).
 *
 *      No prior axis measures this. Axis-3 (rank-correlation across
 *      lenses on midpoints) is per-source and is across LENSES;
 *      axis-20 is across SOURCES for each fixed LENS. Axis-13
 *      (midpoint dispersion) measures the spread of the six
 *      midpoints WITHIN a source; axis-20 measures the SLOPE
 *      between two distinct quantities (midpoint magnitude vs.
 *      half-width) across the source population for one lens at
 *      a time.
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.246. For each lens L:
 *
 *   For each source s in S (sources present in ALL six lens
 *   reports):
 *     midpoint_{L,s}   = (ciUpper_{L,s} + ciLower_{L,s}) / 2
 *     halfWidth_{L,s}  = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *     absMid_{L,s}     = |midpoint_{L,s}|
 *
 *   Let n = |S|. Define:
 *     mAbsMid_L  = (1/n) * sum_s absMid_{L,s}
 *     mHalf_L    = (1/n) * sum_s halfWidth_{L,s}
 *     varAbsMid_L = (1/n) * sum_s (absMid_{L,s} - mAbsMid_L)^2
 *     varHalf_L   = (1/n) * sum_s (halfWidth_{L,s} - mHalf_L)^2
 *     covL        = (1/n) * sum_s
 *                     (absMid_{L,s} - mAbsMid_L) *
 *                     (halfWidth_{L,s} - mHalf_L)
 *     pearsonR_L  = covL / sqrt(varAbsMid_L * varHalf_L)
 *
 *   Edge cases:
 *     - n < 3 (fewer than 3 shared sources): pearsonR_L = 0,
 *       degenerateFlag = true, reason = 'too-few-sources'.
 *     - varAbsMid_L = 0 (all sources have identical |midpoint|):
 *       pearsonR_L = 0, degenerateFlag = true,
 *       reason = 'zero-variance-absmid'.
 *     - varHalf_L = 0 (all sources have identical half-width):
 *       pearsonR_L = 0, degenerateFlag = true,
 *       reason = 'zero-variance-halfwidth'.
 *
 *   Numerical safety: if Pearson r evaluates to a non-finite value
 *   for any other reason, it is clamped to 0 with degenerateFlag
 *   = true, reason = 'non-finite'.
 *
 * Per-lens columns:
 *   - `lens`            — canonical lens name
 *   - `nShared`         — number of shared sources used
 *   - `meanAbsMidpoint` — mean of |midpoint_s| across sources
 *   - `meanHalfWidth`   — mean of halfWidth_s across sources
 *   - `varAbsMidpoint`  — population variance of |midpoint_s|
 *   - `varHalfWidth`    — population variance of halfWidth_s
 *   - `covariance`      — population covariance of |midpoint| and
 *                          half-width
 *   - `pearsonR`        — Pearson correlation in [-1, +1]
 *   - `pearsonRSquared` — pearsonR^2 (coefficient of determination)
 *   - `regimeLabel`     — qualitative bin:
 *                          'strong-positive'  (r >  +0.5)
 *                          'mild-positive'    (r in (+0.1, +0.5])
 *                          'near-zero'        (r in [-0.1, +0.1])
 *                          'mild-negative'    (r in [-0.5, -0.1))
 *                          'strong-negative'  (r <  -0.5)
 *                          'degenerate'       (degenerateFlag)
 *   - `degenerateFlag`  — true iff the lens fell into an edge case
 *   - `degenerateReason` — one of the strings above, or null
 *
 * Report-level:
 *   - meanPearsonR        — mean of non-degenerate pearsonR
 *   - medianPearsonR      — median of non-degenerate pearsonR
 *   - maxPearsonR         — max of non-degenerate pearsonR
 *   - minPearsonR         — min of non-degenerate pearsonR
 *   - rangePearsonR       — max - min of non-degenerate pearsonR
 *                            (cross-lens divergence in
 *                            heteroscedasticity regime)
 *   - nDegenerate         — # lenses with degenerateFlag = true
 *   - nStrongPositive     — # lenses with regimeLabel
 *                            == 'strong-positive'
 *   - nStrongNegative     — # lenses with regimeLabel
 *                            == 'strong-negative'
 *   - nNearZero           — # lenses with regimeLabel == 'near-zero'
 *   - mostHeteroscedasticLens   — argmax_L pearsonR_L over non-
 *                                  degenerate lenses (canonical
 *                                  tie-break)
 *   - mostHomoscedasticLens     — argmin_L |pearsonR_L| over non-
 *                                  degenerate lenses (canonical
 *                                  tie-break)
 *   - mostAntiHeteroscedasticLens — argmin_L pearsonR_L over non-
 *                                  degenerate lenses (canonical
 *                                  tie-break)
 *
 * Filters:
 *   - --alert-pearson <f>   — keep lenses with |pearsonR| >  f
 *   - --alert-positive <f>  — keep lenses with  pearsonR  >  f
 *
 * Threshold rationale:
 *   - |r| <= 0.1   ≈ near-zero by Cohen's classical small-effect
 *     bound; lens is effectively homoscedastic across the source
 *     population.
 *   - |r| >= 0.5   ≈ Cohen's large-effect bound; lens exhibits
 *     strong scale-dependence of CI width on |slope|.
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_MID_CORR_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthMidCorrLensName =
  (typeof SLOPE_LENS_WIDTH_MID_CORR_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 3;
const STRONG_THRESHOLD = 0.5;
const NEAR_ZERO_THRESHOLD = 0.1;

export type DegenerateReason =
  | 'too-few-sources'
  | 'zero-variance-absmid'
  | 'zero-variance-halfwidth'
  | 'non-finite';

export type RegimeLabel =
  | 'strong-positive'
  | 'mild-positive'
  | 'near-zero'
  | 'mild-negative'
  | 'strong-negative'
  | 'degenerate';

export interface SourceRowTokenSlopeCiLensWidthMidpointCorrelationOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertPearson?: number | null;
  alertPositive?: number | null;
  sort?:
    | 'pearson-desc'
    | 'pearson-asc'
    | 'abs-pearson-desc'
    | 'abs-pearson-asc'
    | 'r-squared-desc'
    | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthMidpointCorrelationLensRow {
  lens: SlopeLensWidthMidCorrLensName;
  nShared: number;
  meanAbsMidpoint: number;
  meanHalfWidth: number;
  varAbsMidpoint: number;
  varHalfWidth: number;
  covariance: number;
  pearsonR: number;
  pearsonRSquared: number;
  regimeLabel: RegimeLabel;
  degenerateFlag: boolean;
  degenerateReason: DegenerateReason | null;
}

export interface SourceRowTokenSlopeCiLensWidthMidpointCorrelationReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertPearson: number | null;
  alertPositive: number | null;
  sort: NonNullable<
    SourceRowTokenSlopeCiLensWidthMidpointCorrelationOptions['sort']
  >;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  meanPearsonR: number;
  medianPearsonR: number;
  maxPearsonR: number;
  minPearsonR: number;
  rangePearsonR: number;
  nDegenerate: number;
  nStrongPositive: number;
  nStrongNegative: number;
  nNearZero: number;
  mostHeteroscedasticLens: SlopeLensWidthMidCorrLensName | null;
  mostHomoscedasticLens: SlopeLensWidthMidCorrLensName | null;
  mostAntiHeteroscedasticLens: SlopeLensWidthMidCorrLensName | null;
  rows: SourceRowTokenSlopeCiLensWidthMidpointCorrelationLensRow[];
}

const VALID_SORTS = [
  'pearson-desc',
  'pearson-asc',
  'abs-pearson-desc',
  'abs-pearson-asc',
  'r-squared-desc',
  'lens',
] as const;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[m]!;
  return (s[m - 1]! + s[m]!) / 2;
}

function classifyRegime(r: number, degenerate: boolean): RegimeLabel {
  if (degenerate) return 'degenerate';
  if (r > STRONG_THRESHOLD) return 'strong-positive';
  if (r > NEAR_ZERO_THRESHOLD) return 'mild-positive';
  if (r >= -NEAR_ZERO_THRESHOLD) return 'near-zero';
  if (r >= -STRONG_THRESHOLD) return 'mild-negative';
  return 'strong-negative';
}

/**
 * Pure helper: given two parallel arrays of equal length (across
 * sources, for one fixed lens), compute the per-lens cross-source
 * Pearson correlation diagnostic. Exposed for direct unit-testing.
 */
export function lensWidthMidpointCorrelation(
  absMidpoints: number[],
  halfWidths: number[],
): {
  nShared: number;
  meanAbsMidpoint: number;
  meanHalfWidth: number;
  varAbsMidpoint: number;
  varHalfWidth: number;
  covariance: number;
  pearsonR: number;
  pearsonRSquared: number;
  degenerateFlag: boolean;
  degenerateReason: DegenerateReason | null;
} {
  if (absMidpoints.length !== halfWidths.length) {
    throw new Error(
      `lensWidthMidpointCorrelation: length mismatch (absMidpoints=${absMidpoints.length}, halfWidths=${halfWidths.length})`,
    );
  }
  for (const v of absMidpoints) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthMidpointCorrelation: absMidpoints must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthMidpointCorrelation: absMidpoints must be non-negative (got ${v})`,
      );
    }
  }
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthMidpointCorrelation: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthMidpointCorrelation: halfWidths must be non-negative (got ${v})`,
      );
    }
  }

  const n = absMidpoints.length;
  if (n < MIN_SHARED_SOURCES) {
    return {
      nShared: n,
      meanAbsMidpoint: 0,
      meanHalfWidth: 0,
      varAbsMidpoint: 0,
      varHalfWidth: 0,
      covariance: 0,
      pearsonR: 0,
      pearsonRSquared: 0,
      degenerateFlag: true,
      degenerateReason: 'too-few-sources',
    };
  }
  let sumA = 0;
  let sumH = 0;
  for (let i = 0; i < n; i++) {
    sumA += absMidpoints[i]!;
    sumH += halfWidths[i]!;
  }
  const meanA = sumA / n;
  const meanH = sumH / n;
  let sa2 = 0;
  let sh2 = 0;
  let sah = 0;
  for (let i = 0; i < n; i++) {
    const da = absMidpoints[i]! - meanA;
    const dh = halfWidths[i]! - meanH;
    sa2 += da * da;
    sh2 += dh * dh;
    sah += da * dh;
  }
  const varA = sa2 / n;
  const varH = sh2 / n;
  const cov = sah / n;
  if (varA === 0) {
    return {
      nShared: n,
      meanAbsMidpoint: meanA,
      meanHalfWidth: meanH,
      varAbsMidpoint: 0,
      varHalfWidth: varH,
      covariance: 0,
      pearsonR: 0,
      pearsonRSquared: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-variance-absmid',
    };
  }
  if (varH === 0) {
    return {
      nShared: n,
      meanAbsMidpoint: meanA,
      meanHalfWidth: meanH,
      varAbsMidpoint: varA,
      varHalfWidth: 0,
      covariance: 0,
      pearsonR: 0,
      pearsonRSquared: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-variance-halfwidth',
    };
  }
  let pearson = cov / Math.sqrt(varA * varH);
  if (!Number.isFinite(pearson)) {
    return {
      nShared: n,
      meanAbsMidpoint: meanA,
      meanHalfWidth: meanH,
      varAbsMidpoint: varA,
      varHalfWidth: varH,
      covariance: cov,
      pearsonR: 0,
      pearsonRSquared: 0,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  // Numerical clamp: floating-point can nudge r slightly outside [-1, +1].
  if (pearson > 1) pearson = 1;
  if (pearson < -1) pearson = -1;
  return {
    nShared: n,
    meanAbsMidpoint: meanA,
    meanHalfWidth: meanH,
    varAbsMidpoint: varA,
    varHalfWidth: varH,
    covariance: cov,
    pearsonR: pearson,
    pearsonRSquared: pearson * pearson,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

export function buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthMidpointCorrelationOptions = {},
): SourceRowTokenSlopeCiLensWidthMidpointCorrelationReport {
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
  const alertPearson = opts.alertPearson ?? null;
  if (alertPearson !== null) {
    if (!Number.isFinite(alertPearson) || alertPearson < 0 || alertPearson > 1) {
      throw new Error(
        `alertPearson must be a finite number in [0, 1] (got ${opts.alertPearson})`,
      );
    }
  }
  const alertPositive = opts.alertPositive ?? null;
  if (alertPositive !== null) {
    if (
      !Number.isFinite(alertPositive) ||
      alertPositive < -1 ||
      alertPositive > 1
    ) {
      throw new Error(
        `alertPositive must be a finite number in [-1, 1] (got ${opts.alertPositive})`,
      );
    }
  }
  const sort = opts.sort ?? 'pearson-desc';
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
    SlopeLensWidthMidCorrLensName,
    Map<string, PerLensRaw>
  > = {
    bootstrap: new Map(bootstrapReport.sources.map((r) => [r.source, r])),
    jackknife: new Map(jackknifeReport.sources.map((r) => [r.source, r])),
    bca: new Map(bcaReport.sources.map((r) => [r.source, r])),
    studentizedT: new Map(studReport.sources.map((r) => [r.source, r])),
    abc: new Map(abcReport.sources.map((r) => [r.source, r])),
    profileLikelihood: new Map(
      profileReport.sources.map((r) => [r.source, r]),
    ),
  };

  const allSources = new Set<string>();
  for (const lens of SLOPE_LENS_WIDTH_MID_CORR_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_MID_CORR_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthMidpointCorrelationLensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_MID_CORR_LENS_NAMES) {
    const absMids: number[] = [];
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const mid = (r.ciUpper + r.ciLower) / 2;
      const halfW = (hi - lo) / 2;
      absMids.push(Math.abs(mid));
      halfs.push(halfW);
    }
    const computed = lensWidthMidpointCorrelation(absMids, halfs);
    const regimeLabel = classifyRegime(computed.pearsonR, computed.degenerateFlag);
    rows.push({
      lens,
      ...computed,
      regimeLabel,
    });
  }

  // Report-level aggregates over non-degenerate lens rows.
  const nonDegen = rows.filter((r) => !r.degenerateFlag);
  const prs = nonDegen.map((r) => r.pearsonR);
  const meanPearsonR =
    prs.length > 0 ? prs.reduce((a, b) => a + b, 0) / prs.length : 0;
  const medianPearsonR = median(prs);
  const maxPearsonR = prs.length > 0 ? Math.max(...prs) : 0;
  const minPearsonR = prs.length > 0 ? Math.min(...prs) : 0;
  const rangePearsonR = prs.length > 0 ? maxPearsonR - minPearsonR : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nStrongPositive = rows.filter(
    (r) => r.regimeLabel === 'strong-positive',
  ).length;
  const nStrongNegative = rows.filter(
    (r) => r.regimeLabel === 'strong-negative',
  ).length;
  const nNearZero = rows.filter((r) => r.regimeLabel === 'near-zero').length;

  // Lens attributions (canonical-order tie-break by virtue of stable
  // iteration in canonical order).
  let mostHeteroscedasticLens: SlopeLensWidthMidCorrLensName | null = null;
  let mostHomoscedasticLens: SlopeLensWidthMidCorrLensName | null = null;
  let mostAntiHeteroscedasticLens: SlopeLensWidthMidCorrLensName | null = null;
  if (nonDegen.length > 0) {
    let bestPos = -Infinity;
    let bestNeg = Infinity;
    let bestAbs = Infinity;
    for (const r of nonDegen) {
      if (r.pearsonR > bestPos) {
        bestPos = r.pearsonR;
        mostHeteroscedasticLens = r.lens;
      }
      if (r.pearsonR < bestNeg) {
        bestNeg = r.pearsonR;
        mostAntiHeteroscedasticLens = r.lens;
      }
      const a = Math.abs(r.pearsonR);
      if (a < bestAbs) {
        bestAbs = a;
        mostHomoscedasticLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertPearson !== null) {
    filtered = filtered.filter((r) => Math.abs(r.pearsonR) > alertPearson);
  }
  if (alertPositive !== null) {
    filtered = filtered.filter((r) => r.pearsonR > alertPositive);
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthMidpointCorrelationLensRow,
      b: SourceRowTokenSlopeCiLensWidthMidpointCorrelationLensRow,
    ) => number
  > = {
    'pearson-desc': (a, b) => b.pearsonR - a.pearsonR,
    'pearson-asc': (a, b) => a.pearsonR - b.pearsonR,
    'abs-pearson-desc': (a, b) => Math.abs(b.pearsonR) - Math.abs(a.pearsonR),
    'abs-pearson-asc': (a, b) => Math.abs(a.pearsonR) - Math.abs(b.pearsonR),
    'r-squared-desc': (a, b) => b.pearsonRSquared - a.pearsonRSquared,
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_MID_CORR_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_MID_CORR_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_MID_CORR_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_MID_CORR_LENS_NAMES.indexOf(b.lens)
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
    alertPearson,
    alertPositive,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    meanPearsonR,
    medianPearsonR,
    maxPearsonR,
    minPearsonR,
    rangePearsonR,
    nDegenerate,
    nStrongPositive,
    nStrongNegative,
    nNearZero,
    mostHeteroscedasticLens,
    mostHomoscedasticLens,
    mostAntiHeteroscedasticLens,
    rows: filtered,
  };
}

function fmtNum(x: number, digits = 4): string {
  if (!Number.isFinite(x)) {
    return x === Infinity ? 'inf' : x === -Infinity ? '-inf' : 'NaN';
  }
  return x.toFixed(digits);
}

/**
 * Plain-text renderer.
 */
export function renderSourceRowTokenSlopeCiLensWidthMidpointCorrelation(
  r: SourceRowTokenSlopeCiLensWidthMidpointCorrelationReport,
  opts: {
    showSummary?: boolean;
    showRegimeAggregate?: boolean;
    showLensAttribution?: boolean;
    showMoments?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showRegimeAggregate = opts.showRegimeAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showMoments = opts.showMoments ?? false;
  const lines: string[] = [];
  lines.push(
    'pew-insights source-row-token-slope-ci-lens-width-midpoint-correlation',
  );
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-pearson: ${r.alertPearson ?? '-'}    alert-positive: ${r.alertPositive ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanR: ${fmtNum(r.meanPearsonR)}; medianR: ${fmtNum(r.medianPearsonR)}; maxR: ${fmtNum(r.maxPearsonR)}; minR: ${fmtNum(r.minPearsonR)}; rangeR: ${fmtNum(r.rangePearsonR)}; nStrongPositive: ${r.nStrongPositive}; nStrongNegative: ${r.nStrongNegative}; nNearZero: ${r.nNearZero}; nDegenerate: ${r.nDegenerate}; mostHetero: ${r.mostHeteroscedasticLens ?? '-'}; mostHomo: ${r.mostHomoscedasticLens ?? '-'}; mostAntiHetero: ${r.mostAntiHeteroscedasticLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     pearsonR  rSquared  regime           reason',
  );
  lines.push(
    '-----------------  ----  --------  --------  ---------------  -----------------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        fmtNum(row.pearsonR).padStart(8),
        fmtNum(row.pearsonRSquared).padStart(8),
        row.regimeLabel.padEnd(15),
        (row.degenerateReason ?? '-').padEnd(23),
      ].join('  '),
    );
    if (showSummary) {
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} r=${fmtNum(row.pearsonR)} r2=${fmtNum(row.pearsonRSquared)} regime=${row.regimeLabel}`,
      );
    }
    if (showMoments) {
      lines.push(
        `    moments: meanAbsMid=${fmtNum(row.meanAbsMidpoint, 6)} meanHalf=${fmtNum(row.meanHalfWidth, 6)} varAbsMid=${fmtNum(row.varAbsMidpoint, 6)} varHalf=${fmtNum(row.varHalfWidth, 6)} cov=${fmtNum(row.covariance, 6)}`,
      );
    }
  }
  if (showRegimeAggregate && r.rows.length > 0) {
    const denom = r.rows.length;
    lines.push(
      `[regime aggregate] nStrongPositive=${r.nStrongPositive}/${denom} (${fmtNum(r.nStrongPositive / denom, 4)}) nStrongNegative=${r.nStrongNegative}/${denom} (${fmtNum(r.nStrongNegative / denom, 4)}) nNearZero=${r.nNearZero}/${denom} (${fmtNum(r.nNearZero / denom, 4)}) nDegenerate=${r.nDegenerate}/${denom} (${fmtNum(r.nDegenerate / denom, 4)}) meanR=${fmtNum(r.meanPearsonR)} medianR=${fmtNum(r.medianPearsonR)} rangeR=${fmtNum(r.rangePearsonR)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostHetero=${r.mostHeteroscedasticLens ?? '-'} (max pearsonR) mostAntiHetero=${r.mostAntiHeteroscedasticLens ?? '-'} (min pearsonR) mostHomo=${r.mostHomoscedasticLens ?? '-'} (min |pearsonR|)`,
    );
  }
  return lines.join('\n');
}
