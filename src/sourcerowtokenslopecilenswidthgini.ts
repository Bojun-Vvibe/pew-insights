/**
 * source-row-token-slope-ci-lens-width-gini
 *
 * Per-lens CROSS-SOURCE GINI COEFFICIENT of CI half-widths
 * (TWENTY-FIRST cross-lens axis) for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six per-source
 * slope CIs as v0.6.227-v0.6.247 (percentile bootstrap, jackknife
 * normal, BCa, studentized-t, ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL TWENTY prior cross-lens diagnostics
 * on TWO orthogonal dimensions, AND distinct from axis-20 along a
 * THIRD:
 *
 *   1. POPULATION GEOMETRY (vs axes 1-19). Axes 1-19 are PER-SOURCE
 *      reductions across the six lenses (population = sources).
 *      This axis, like axis-20, INVERTS the geometry — for each
 *      fixed LENS we summarise the across-source distribution
 *      (population = lenses, six rows). No prior 1-19 computes a
 *      non-trivial cross-source statistic conditional on a fixed
 *      lens.
 *
 *   2. STATISTIC FAMILY (vs all 1-20). This is a UNIVARIATE
 *      INEQUALITY / CONCENTRATION measure on a SINGLE distribution
 *      (the across-source half-widths for one lens). Every prior
 *      cross-lens axis is either:
 *        - a per-source scalar with cross-source aggregation only as
 *          mean / median / mode of the scalar (axes 1-19), OR
 *        - a BIVARIATE Pearson correlation between two distinct
 *          per-source quantities (axis-20: |midpoint| vs half-width).
 *      Axis-21 is neither: it is a UNIVARIATE Lorenz-curve / mean-
 *      absolute-difference inequality coefficient on a single
 *      distribution. There is no second variable, no covariance, no
 *      regression, no entropy. The Gini coefficient is mathematically
 *      independent of the log-ratio-variance (axis-19) and of
 *      Shannon entropy (axis-17): a Pareto distribution and a
 *      lognormal can share log-ratio-variance while having different
 *      Gini, and two distributions can share Shannon entropy
 *      (continuous-rank discretised) while having different Gini.
 *
 *   3. SCALE INVARIANCE (vs axis-20). Pearson correlation r is
 *      INVARIANT under independent positive affine rescaling of the
 *      two variables; the Gini coefficient G is INVARIANT under
 *      positive scalar multiplication of the single distribution but
 *      NOT under additive shifts. They probe different invariants of
 *      the half-width distribution: axis-20 asks "does CI width
 *      grow proportionally with |slope|?"; axis-21 asks "is the CI
 *      width budget concentrated in a few sources or spread evenly?"
 *      A lens with uniform (nearly-equal) half-widths has G ~ 0
 *      regardless of axis-20's r. A lens with one source dominating
 *      the width budget has G near (n-1)/n regardless of whether
 *      that source is the largest |slope| (axis-20 r) or not.
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.247. For each lens L:
 *
 *   For each source s in S (sources present in ALL six lens
 *   reports):
 *     halfWidth_{L,s} = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *
 *   Let n = |S|. The Gini coefficient on the n half-widths
 *   x_1, ..., x_n (using the canonical mean-absolute-difference
 *   formulation; see Sen 1973, Cowell 2011):
 *
 *     mean_L = (1/n) * sum_i x_i
 *     mad_L  = (1/(2 n^2)) * sum_i sum_j |x_i - x_j|
 *     gini_L = mad_L / mean_L      if mean_L > 0
 *
 *   Equivalent sorted-form computation (used here for O(n log n)):
 *     sort x ascending -> y_1 <= y_2 <= ... <= y_n
 *     gini_L = (1 / (n^2 * mean_L)) *
 *               sum_{i=1..n} (2 i - n - 1) * y_i
 *
 *   Both forms agree algebraically and produce gini_L in [0, 1):
 *     - gini_L = 0  iff all half-widths are identical (perfect
 *       cross-source equality of CI width)
 *     - gini_L -> (n-1)/n  in the limit where one source absorbs
 *       all the half-width budget
 *
 *   Edge cases:
 *     - n < 3 (fewer than 3 shared sources): gini_L = 0,
 *       degenerateFlag = true, reason = 'too-few-sources'.
 *     - mean_L = 0 (all half-widths are exactly zero -- every CI
 *       collapses to a point): gini_L = 0, degenerateFlag = true,
 *       reason = 'zero-mean-halfwidth'.
 *     - any half-width is negative or non-finite (cannot happen for
 *       well-formed CIs but defended): throws.
 *
 *   Numerical safety: floating-point can nudge the sorted-form gini
 *   slightly outside [0, 1]; the result is clamped to [0, 1].
 *
 * Per-lens columns:
 *   - `lens`            — canonical lens name
 *   - `nShared`         — number of shared sources used
 *   - `meanHalfWidth`   — mean of halfWidth_s across sources
 *   - `minHalfWidth`    — min of halfWidth_s across sources
 *   - `maxHalfWidth`    — max of halfWidth_s across sources
 *   - `mad`             — mean absolute pairwise difference
 *                          (1/(2 n^2)) * sum_ij |x_i - x_j|
 *   - `gini`            — Gini coefficient in [0, 1)
 *   - `topShareMax`     — max_i x_i / sum_i x_i  (share of total
 *                          half-width-budget held by the largest
 *                          source); 0 if sum is 0
 *   - `concentrationLabel` — qualitative bin:
 *                          'highly-concentrated'   (gini >  0.5)
 *                          'moderately-concentrated' (gini in (0.3, 0.5])
 *                          'mild-concentration'    (gini in (0.1, 0.3])
 *                          'near-equal'            (gini in [0,   0.1])
 *                          'degenerate'            (degenerateFlag)
 *   - `degenerateFlag`  — true iff the lens fell into an edge case
 *   - `degenerateReason` — one of the strings above, or null
 *
 * Report-level:
 *   - meanGini             — mean of non-degenerate gini values
 *   - medianGini           — median of non-degenerate gini values
 *   - maxGini              — max of non-degenerate gini values
 *   - minGini              — min of non-degenerate gini values
 *   - rangeGini            — max - min of non-degenerate gini
 *                             (cross-lens divergence in
 *                             concentration regime)
 *   - nDegenerate          — # lenses with degenerateFlag = true
 *   - nHighlyConcentrated  — # lenses with gini > 0.5
 *   - nNearEqual           — # lenses with gini <= 0.1
 *   - mostConcentratedLens — argmax_L gini_L (canonical tie-break)
 *   - mostEqualLens        — argmin_L gini_L (canonical tie-break)
 *
 * Filters:
 *   - --alert-gini <f>           — keep lenses with gini > f (f in [0, 1])
 *   - --alert-concentrated <f>   — alias of --alert-gini for symmetry
 *                                   with axis-20 naming
 *
 * Threshold rationale:
 *   - gini <= 0.1 is the conventional "near-equal" inequality bound
 *     used in income-distribution literature (Cowell 2011).
 *   - gini >  0.5 is conventionally "highly unequal".
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_GINI_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthGiniLensName =
  (typeof SLOPE_LENS_WIDTH_GINI_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 3;
const HIGH_GINI_THRESHOLD = 0.5;
const MODERATE_GINI_THRESHOLD = 0.3;
const NEAR_EQUAL_GINI_THRESHOLD = 0.1;

export type DegenerateReason =
  | 'too-few-sources'
  | 'zero-mean-halfwidth'
  | 'non-finite';

export type ConcentrationLabel =
  | 'highly-concentrated'
  | 'moderately-concentrated'
  | 'mild-concentration'
  | 'near-equal'
  | 'degenerate';

export interface SourceRowTokenSlopeCiLensWidthGiniOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertGini?: number | null;
  sort?:
    | 'gini-desc'
    | 'gini-asc'
    | 'mean-halfwidth-desc'
    | 'top-share-desc'
    | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthGiniLensRow {
  lens: SlopeLensWidthGiniLensName;
  nShared: number;
  meanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  mad: number;
  gini: number;
  topShareMax: number;
  concentrationLabel: ConcentrationLabel;
  degenerateFlag: boolean;
  degenerateReason: DegenerateReason | null;
  /**
   * The per-source half-widths that fed into the Gini computation,
   * in the canonical sorted-source order used to build the report.
   * Surfaced for diagnostic / audit use.
   */
  perSourceHalfWidths: number[];
  perSourceSources: string[];
}

export interface SourceRowTokenSlopeCiLensWidthGiniReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertGini: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiLensWidthGiniOptions['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  meanGini: number;
  medianGini: number;
  maxGini: number;
  minGini: number;
  rangeGini: number;
  nDegenerate: number;
  nHighlyConcentrated: number;
  nNearEqual: number;
  mostConcentratedLens: SlopeLensWidthGiniLensName | null;
  mostEqualLens: SlopeLensWidthGiniLensName | null;
  rows: SourceRowTokenSlopeCiLensWidthGiniLensRow[];
}

const VALID_SORTS = [
  'gini-desc',
  'gini-asc',
  'mean-halfwidth-desc',
  'top-share-desc',
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
  gini: number,
  degenerate: boolean,
): ConcentrationLabel {
  if (degenerate) return 'degenerate';
  if (gini > HIGH_GINI_THRESHOLD) return 'highly-concentrated';
  if (gini > MODERATE_GINI_THRESHOLD) return 'moderately-concentrated';
  if (gini > NEAR_EQUAL_GINI_THRESHOLD) return 'mild-concentration';
  return 'near-equal';
}

/**
 * Pure helper: given an array of non-negative half-widths across
 * sources for one fixed lens, compute the per-lens cross-source
 * Gini coefficient diagnostic. Exposed for direct unit-testing.
 */
export function lensWidthGini(halfWidths: number[]): {
  nShared: number;
  meanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  mad: number;
  gini: number;
  topShareMax: number;
  degenerateFlag: boolean;
  degenerateReason: DegenerateReason | null;
} {
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthGini: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthGini: halfWidths must be non-negative (got ${v})`,
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
      mad: 0,
      gini: 0,
      topShareMax: 0,
      degenerateFlag: true,
      degenerateReason: 'too-few-sources',
    };
  }
  let sum = 0;
  let mn = Infinity;
  let mx = -Infinity;
  for (const v of halfWidths) {
    sum += v;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const mean = sum / n;
  if (mean === 0) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      minHalfWidth: mn,
      maxHalfWidth: mx,
      mad: 0,
      gini: 0,
      topShareMax: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-mean-halfwidth',
    };
  }
  // Sorted-form Gini in O(n log n):
  //   gini = (1 / (n^2 * mean)) * sum_i (2 i - n - 1) * y_i
  // (i 1-indexed, y sorted ascending).
  const sorted = [...halfWidths].sort((a, b) => a - b);
  let weighted = 0;
  for (let i = 0; i < n; i++) {
    const k = i + 1; // 1-indexed
    weighted += (2 * k - n - 1) * sorted[i]!;
  }
  let gini = weighted / (n * n * mean);
  // Also compute MAD directly for surfacing (O(n^2) on n <= a few
  // dozen sources is trivial; gives algebraic equivalence check).
  let pairAbs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      pairAbs += Math.abs(halfWidths[i]! - halfWidths[j]!);
    }
  }
  const mad = pairAbs / (2 * n * n);
  // Numerical clamp.
  if (!Number.isFinite(gini)) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      minHalfWidth: mn,
      maxHalfWidth: mx,
      mad,
      gini: 0,
      topShareMax: 0,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  if (gini < 0) gini = 0;
  if (gini > 1) gini = 1;
  const topShareMax = sum > 0 ? mx / sum : 0;
  return {
    nShared: n,
    meanHalfWidth: mean,
    minHalfWidth: mn,
    maxHalfWidth: mx,
    mad,
    gini,
    topShareMax,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

export function buildSourceRowTokenSlopeCiLensWidthGini(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthGiniOptions = {},
): SourceRowTokenSlopeCiLensWidthGiniReport {
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
  const alertGini = opts.alertGini ?? null;
  if (alertGini !== null) {
    if (!Number.isFinite(alertGini) || alertGini < 0 || alertGini > 1) {
      throw new Error(
        `alertGini must be a finite number in [0, 1] (got ${opts.alertGini})`,
      );
    }
  }
  const sort = opts.sort ?? 'gini-desc';
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
  const lensReports: Record<SlopeLensWidthGiniLensName, Map<string, PerLensRaw>> = {
    bootstrap: new Map(bootstrapReport.sources.map((r) => [r.source, r])),
    jackknife: new Map(jackknifeReport.sources.map((r) => [r.source, r])),
    bca: new Map(bcaReport.sources.map((r) => [r.source, r])),
    studentizedT: new Map(studReport.sources.map((r) => [r.source, r])),
    abc: new Map(abcReport.sources.map((r) => [r.source, r])),
    profileLikelihood: new Map(profileReport.sources.map((r) => [r.source, r])),
  };

  const allSources = new Set<string>();
  for (const lens of SLOPE_LENS_WIDTH_GINI_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_GINI_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthGiniLensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_GINI_LENS_NAMES) {
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const halfW = (hi - lo) / 2;
      halfs.push(halfW);
    }
    const computed = lensWidthGini(halfs);
    const concentrationLabel = classifyConcentration(
      computed.gini,
      computed.degenerateFlag,
    );
    rows.push({
      lens,
      ...computed,
      concentrationLabel,
      perSourceHalfWidths: halfs,
      perSourceSources: [...sharedSources],
    });
  }

  const nonDegen = rows.filter((r) => !r.degenerateFlag);
  const ginis = nonDegen.map((r) => r.gini);
  const meanGini =
    ginis.length > 0 ? ginis.reduce((a, b) => a + b, 0) / ginis.length : 0;
  const medianGini = median(ginis);
  const maxGini = ginis.length > 0 ? Math.max(...ginis) : 0;
  const minGini = ginis.length > 0 ? Math.min(...ginis) : 0;
  const rangeGini = ginis.length > 0 ? maxGini - minGini : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nHighlyConcentrated = rows.filter(
    (r) => r.concentrationLabel === 'highly-concentrated',
  ).length;
  const nNearEqual = rows.filter(
    (r) => r.concentrationLabel === 'near-equal',
  ).length;

  let mostConcentratedLens: SlopeLensWidthGiniLensName | null = null;
  let mostEqualLens: SlopeLensWidthGiniLensName | null = null;
  if (nonDegen.length > 0) {
    let bestHi = -Infinity;
    let bestLo = Infinity;
    for (const r of nonDegen) {
      if (r.gini > bestHi) {
        bestHi = r.gini;
        mostConcentratedLens = r.lens;
      }
      if (r.gini < bestLo) {
        bestLo = r.gini;
        mostEqualLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertGini !== null) {
    filtered = filtered.filter((r) => r.gini > alertGini);
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthGiniLensRow,
      b: SourceRowTokenSlopeCiLensWidthGiniLensRow,
    ) => number
  > = {
    'gini-desc': (a, b) => b.gini - a.gini,
    'gini-asc': (a, b) => a.gini - b.gini,
    'mean-halfwidth-desc': (a, b) => b.meanHalfWidth - a.meanHalfWidth,
    'top-share-desc': (a, b) => b.topShareMax - a.topShareMax,
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_GINI_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_GINI_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_GINI_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_GINI_LENS_NAMES.indexOf(b.lens)
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
    alertGini,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    meanGini,
    medianGini,
    maxGini,
    minGini,
    rangeGini,
    nDegenerate,
    nHighlyConcentrated,
    nNearEqual,
    mostConcentratedLens,
    mostEqualLens,
    rows: filtered,
  };
}

function fmtNum(x: number, digits = 4): string {
  if (!Number.isFinite(x)) {
    return x === Infinity ? 'inf' : x === -Infinity ? '-inf' : 'NaN';
  }
  return x.toFixed(digits);
}

export function renderSourceRowTokenSlopeCiLensWidthGini(
  r: SourceRowTokenSlopeCiLensWidthGiniReport,
  opts: {
    showSummary?: boolean;
    showConcentrationAggregate?: boolean;
    showLensAttribution?: boolean;
    showMoments?: boolean;
    showPerSourceWidths?: boolean;
    showLorenz?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showConcentrationAggregate = opts.showConcentrationAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showMoments = opts.showMoments ?? false;
  const showPerSourceWidths = opts.showPerSourceWidths ?? false;
  const showLorenz = opts.showLorenz ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-width-gini');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-gini: ${r.alertGini ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanGini: ${fmtNum(r.meanGini)}; medianGini: ${fmtNum(r.medianGini)}; maxGini: ${fmtNum(r.maxGini)}; minGini: ${fmtNum(r.minGini)}; rangeGini: ${fmtNum(r.rangeGini)}; nHighlyConcentrated: ${r.nHighlyConcentrated}; nNearEqual: ${r.nNearEqual}; nDegenerate: ${r.nDegenerate}; mostConcentrated: ${r.mostConcentratedLens ?? '-'}; mostEqual: ${r.mostEqualLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     gini     topShare  concentration            reason',
  );
  lines.push(
    '-----------------  ----  -------  --------  -----------------------  -----------------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        fmtNum(row.gini).padStart(7),
        fmtNum(row.topShareMax).padStart(8),
        row.concentrationLabel.padEnd(23),
        (row.degenerateReason ?? '-').padEnd(23),
      ].join('  '),
    );
    if (showSummary) {
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} gini=${fmtNum(row.gini)} topShare=${fmtNum(row.topShareMax)} concentration=${row.concentrationLabel}`,
      );
    }
    if (showMoments) {
      lines.push(
        `    moments: meanHalf=${fmtNum(row.meanHalfWidth, 6)} minHalf=${fmtNum(row.minHalfWidth, 6)} maxHalf=${fmtNum(row.maxHalfWidth, 6)} mad=${fmtNum(row.mad, 6)}`,
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
    if (showLorenz) {
      // Lorenz curve: sort half-widths ascending, then for each
      // cumulative-rank fraction k/n in (0, 1] emit the cumulative
      // share of total half-width budget held by the bottom k
      // sources. The diagonal y = x is perfect equality; the
      // closer the curve hugs the x-axis before snapping up, the
      // more concentrated the budget. The 0,0 anchor is implicit.
      const halfs = [...row.perSourceHalfWidths].sort((a, b) => a - b);
      const sum = halfs.reduce((a, b) => a + b, 0);
      if (halfs.length === 0) {
        lines.push(`    lorenz: (no shared sources)`);
      } else if (sum === 0) {
        lines.push(`    lorenz: (zero-mean -- curve undefined)`);
      } else {
        const points: string[] = [];
        let cum = 0;
        for (let i = 0; i < halfs.length; i++) {
          cum += halfs[i]!;
          const popFrac = (i + 1) / halfs.length;
          const cumShare = cum / sum;
          points.push(`(${fmtNum(popFrac, 4)},${fmtNum(cumShare, 4)})`);
        }
        lines.push(`    lorenz: ${points.join(' ')}`);
      }
    }
  }
  if (showConcentrationAggregate && r.rows.length > 0) {
    const denom = r.rows.length;
    lines.push(
      `[concentration aggregate] nHighlyConcentrated=${r.nHighlyConcentrated}/${denom} (${fmtNum(r.nHighlyConcentrated / denom, 4)}) nNearEqual=${r.nNearEqual}/${denom} (${fmtNum(r.nNearEqual / denom, 4)}) nDegenerate=${r.nDegenerate}/${denom} (${fmtNum(r.nDegenerate / denom, 4)}) meanGini=${fmtNum(r.meanGini)} medianGini=${fmtNum(r.medianGini)} rangeGini=${fmtNum(r.rangeGini)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostConcentrated=${r.mostConcentratedLens ?? '-'} (max gini) mostEqual=${r.mostEqualLens ?? '-'} (min gini)`,
    );
  }
  return lines.join('\n');
}
