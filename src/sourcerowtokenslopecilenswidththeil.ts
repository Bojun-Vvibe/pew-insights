/**
 * source-row-token-slope-ci-lens-width-theil
 *
 * Per-lens CROSS-SOURCE THEIL INDEX (T_T) of CI half-widths
 * (TWENTY-SECOND cross-lens axis) for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six per-source
 * slope CIs as v0.6.227-v0.6.248 (percentile bootstrap, jackknife
 * normal, BCa, studentized-t, ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL TWENTY-ONE prior cross-lens
 * diagnostics on FOUR orthogonal dimensions, AND in particular
 * distinct from axis-21 (Gini) along TWO of those dimensions:
 *
 *   1. POPULATION GEOMETRY (vs axes 1-19). Like axes 20 and 21,
 *      this axis is INDEXED BY LENS (six rows), inverting the
 *      per-source geometry of axes 1-19.
 *
 *   2. STATISTIC FAMILY (vs all 1-20). This is a UNIVARIATE
 *      INFORMATION-THEORETIC INEQUALITY measure (a generalised-
 *      entropy index of order alpha = 1) on a single distribution
 *      (across-source half-widths for one lens). It is not a
 *      Pearson r, not an empirical entropy of a distribution shape
 *      (axis-17), and not a log-ratio variance (axis-19).
 *
 *   3. WEIGHTING / DECOMPOSABILITY (vs axis-21 Gini). The Theil
 *      index belongs to the generalised-entropy family
 *      GE(alpha) and is the alpha = 1 case:
 *
 *          T_T = (1/n) sum_i (x_i / mu) * ln(x_i / mu)
 *              = sum_i p_i * ln(p_i / (1/n)),    p_i = x_i / sum_j x_j
 *
 *      It equals the Kullback-Leibler divergence of the share
 *      distribution {p_i} from the uniform distribution {1/n}.
 *      This makes T_T:
 *        - SUBGROUP-DECOMPOSABLE: T_T(total) = T_T(within) +
 *          T_T(between). Gini is NOT additively decomposable in
 *          general (the cross-group overlap term is non-zero unless
 *          the subgroup distributions don't overlap).
 *        - LOG-WEIGHTED: each source's contribution is weighted by
 *          its share (x_i / mu) and by ln(x_i / mu). Gini is
 *          weighted only by the rank gap (2 i - n - 1).
 *        - TOP-SENSITIVE: T_T is much more sensitive to a single
 *          large outlier than Gini. Gini's marginal response to a
 *          rich-end transfer is bounded by 2/n; T_T's response
 *          grows like ln(x_i / mu).
 *
 *      Concretely: a lens whose half-widths are
 *      (1, 1, 1, 1, 1, 1) has T_T = 0 and Gini = 0. A lens whose
 *      half-widths are (1, 1, 1, 1, 1, 100) has Gini ~ 0.71 and
 *      T_T ~ 1.43 (much greater than Gini in absolute terms,
 *      because Gini is bounded by (n-1)/n ~ 0.83 here while T_T
 *      can grow to ln(n) ~ 1.79). The two indices DISAGREE on the
 *      ordering of two distributions that differ only in how mass
 *      is moved between the middle and the tail vs between two
 *      mid-rank elements -- this is the documented "Pigou-Dalton
 *      transfer sensitivity" difference between GE(0) (mean-log-
 *      deviation), GE(1) (Theil), and the Gini.
 *
 *   4. UPPER BOUND BEHAVIOUR (vs axis-21). Gini in [0, (n-1)/n]
 *      with equality at one-source-takes-all; Theil in [0, ln(n)]
 *      with equality at the same configuration. The two upper
 *      bounds scale differently with n (linear vs logarithmic),
 *      so the same "mostly-uniform" lens will register VERY
 *      different normalised values under the two indices.
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.248. For each lens L:
 *
 *   For each source s in S (sources present in ALL six lens
 *   reports):
 *     halfWidth_{L,s} = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *
 *   Let n = |S|. The Theil index on the n half-widths
 *   x_1, ..., x_n (Theil 1967; Cowell 2011, GE family):
 *
 *     mean_L  = (1/n) * sum_i x_i
 *     theil_L = (1/n) * sum_{i: x_i > 0} (x_i / mean_L) *
 *                  ln(x_i / mean_L)
 *
 *   The convention used here for x_i = 0 is the limit
 *   x ln(x / mu) -> 0 as x -> 0+, i.e. zero half-width sources
 *   contribute zero to T_T. This is the standard treatment in
 *   the inequality literature (Theil 1967 sect. 4.3; Cowell &
 *   Kuga 1981) and matches the GE(1) limit
 *   GE(alpha) -> Theil as alpha -> 1.
 *
 *   Equivalent share form (used here for stable computation):
 *     p_i = x_i / (sum_j x_j),  i = 1..n
 *     theil_L = sum_{i: p_i > 0} p_i * ln(n * p_i)
 *             = ln(n) + sum_{i: p_i > 0} p_i * ln(p_i)
 *             = ln(n) - H_shannon(p)
 *
 *   so theil_L is exactly the KL divergence
 *   D_KL(p || uniform_n) = ln(n) - H(p), and lies in
 *   [0, ln(n)]:
 *     - theil_L = 0  iff all half-widths are identical
 *     - theil_L = ln(n)  iff one source absorbs the entire
 *       half-width budget (p concentrated on a single index)
 *
 *   Edge cases:
 *     - n < 3 (fewer than 3 shared sources): theil_L = 0,
 *       degenerateFlag = true, reason = 'too-few-sources'.
 *     - mean_L = 0 (all half-widths are exactly zero -- every
 *       CI collapses to a point): theil_L = 0, degenerateFlag =
 *       true, reason = 'zero-mean-halfwidth'.
 *     - any half-width is negative or non-finite (cannot happen
 *       for well-formed CIs but defended): throws.
 *
 *   Numerical safety: floating-point can nudge T_T slightly
 *   outside [0, ln(n)]; the result is clamped to that interval.
 *
 *   Normalised index: theilNorm_L = theil_L / ln(n) in [0, 1],
 *   to allow direct comparison with the Gini coefficient
 *   axis-21 across lenses with the same n. (When n changes,
 *   compare theilNorm rather than theil.)
 *
 * Per-lens columns:
 *   - `lens`            — canonical lens name
 *   - `nShared`         — number of shared sources used
 *   - `meanHalfWidth`   — mean of halfWidth_s across sources
 *   - `minHalfWidth`    — min of halfWidth_s across sources
 *   - `maxHalfWidth`    — max of halfWidth_s across sources
 *   - `lnN`             — ln(n) (the upper bound for theil)
 *   - `shannonEntropy`  — H(p) = -sum p_i ln p_i, in nats
 *   - `theil`           — Theil GE(1) index in [0, ln(n)]
 *   - `theilNorm`       — theil / ln(n) in [0, 1]
 *   - `topShareMax`     — max_i x_i / sum_i x_i  (share of total
 *                          half-width budget held by the largest
 *                          source); 0 if sum is 0
 *   - `concentrationLabel` — qualitative bin on theilNorm:
 *                          'highly-concentrated'   (theilNorm >  0.5)
 *                          'moderately-concentrated' (theilNorm in (0.3, 0.5])
 *                          'mild-concentration'    (theilNorm in (0.1, 0.3])
 *                          'near-equal'            (theilNorm in [0,   0.1])
 *                          'degenerate'            (degenerateFlag)
 *   - `degenerateFlag`  — true iff the lens fell into an edge case
 *   - `degenerateReason` — one of the strings above, or null
 *
 * Report-level:
 *   - meanTheil             — mean of non-degenerate theil values
 *   - medianTheil           — median of non-degenerate theil values
 *   - maxTheil              — max of non-degenerate theil values
 *   - minTheil              — min of non-degenerate theil values
 *   - rangeTheil            — max - min
 *   - meanTheilNorm         — mean of non-degenerate theilNorm values
 *   - nDegenerate           — # lenses with degenerateFlag
 *   - nHighlyConcentrated   — # lenses with theilNorm > 0.5
 *   - nNearEqual            — # lenses with theilNorm <= 0.1
 *   - mostConcentratedLens  — argmax_L theil_L (canonical tie-break)
 *   - mostEqualLens         — argmin_L theil_L (canonical tie-break)
 *
 * Filters:
 *   - --alert-theil <f>      — keep lenses with theil > f
 *   - --alert-theil-norm <f> — keep lenses with theilNorm > f
 *                               (f in [0, 1])
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_THEIL_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthTheilLensName =
  (typeof SLOPE_LENS_WIDTH_THEIL_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 3;
const HIGH_THEILNORM_THRESHOLD = 0.5;
const MODERATE_THEILNORM_THRESHOLD = 0.3;
const NEAR_EQUAL_THEILNORM_THRESHOLD = 0.1;

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

export interface SourceRowTokenSlopeCiLensWidthTheilOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertTheil?: number | null;
  alertTheilNorm?: number | null;
  sort?:
    | 'theil-desc'
    | 'theil-asc'
    | 'theil-norm-desc'
    | 'mean-halfwidth-desc'
    | 'top-share-desc'
    | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthTheilLensRow {
  lens: SlopeLensWidthTheilLensName;
  nShared: number;
  meanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  lnN: number;
  shannonEntropy: number;
  theil: number;
  theilNorm: number;
  topShareMax: number;
  concentrationLabel: ConcentrationLabel;
  degenerateFlag: boolean;
  degenerateReason: DegenerateReason | null;
  /**
   * The per-source half-widths that fed into the Theil
   * computation, in the canonical sorted-source order used to
   * build the report. Surfaced for diagnostic / audit use.
   */
  perSourceHalfWidths: number[];
  perSourceSources: string[];
}

export interface SourceRowTokenSlopeCiLensWidthTheilReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertTheil: number | null;
  alertTheilNorm: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiLensWidthTheilOptions['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  meanTheil: number;
  medianTheil: number;
  maxTheil: number;
  minTheil: number;
  rangeTheil: number;
  meanTheilNorm: number;
  nDegenerate: number;
  nHighlyConcentrated: number;
  nNearEqual: number;
  mostConcentratedLens: SlopeLensWidthTheilLensName | null;
  mostEqualLens: SlopeLensWidthTheilLensName | null;
  rows: SourceRowTokenSlopeCiLensWidthTheilLensRow[];
}

const VALID_SORTS = [
  'theil-desc',
  'theil-asc',
  'theil-norm-desc',
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
  theilNorm: number,
  degenerate: boolean,
): ConcentrationLabel {
  if (degenerate) return 'degenerate';
  if (theilNorm > HIGH_THEILNORM_THRESHOLD) return 'highly-concentrated';
  if (theilNorm > MODERATE_THEILNORM_THRESHOLD) return 'moderately-concentrated';
  if (theilNorm > NEAR_EQUAL_THEILNORM_THRESHOLD) return 'mild-concentration';
  return 'near-equal';
}

/**
 * Pure helper: given an array of non-negative half-widths across
 * sources for one fixed lens, compute the per-lens cross-source
 * Theil-index diagnostic. Exposed for direct unit-testing.
 */
export function lensWidthTheil(halfWidths: number[]): {
  nShared: number;
  meanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  lnN: number;
  shannonEntropy: number;
  theil: number;
  theilNorm: number;
  topShareMax: number;
  degenerateFlag: boolean;
  degenerateReason: DegenerateReason | null;
} {
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthTheil: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthTheil: halfWidths must be non-negative (got ${v})`,
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
      lnN: n > 0 ? Math.log(n) : 0,
      shannonEntropy: 0,
      theil: 0,
      theilNorm: 0,
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
  const lnN = Math.log(n);
  if (mean === 0) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      minHalfWidth: mn,
      maxHalfWidth: mx,
      lnN,
      shannonEntropy: 0,
      theil: 0,
      theilNorm: 0,
      topShareMax: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-mean-halfwidth',
    };
  }
  // Compute via shares for numerical stability:
  //   theil = ln(n) - H(p), with H(p) = -sum p_i ln p_i (nats),
  //   summing only over p_i > 0 (limit x ln x -> 0 as x -> 0+).
  let H = 0;
  for (const v of halfWidths) {
    if (v <= 0) continue;
    const p = v / sum;
    H += -p * Math.log(p);
  }
  let theil = lnN - H;
  if (!Number.isFinite(theil)) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      minHalfWidth: mn,
      maxHalfWidth: mx,
      lnN,
      shannonEntropy: H,
      theil: 0,
      theilNorm: 0,
      topShareMax: 0,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  // Numerical clamp into [0, ln(n)].
  if (theil < 0) theil = 0;
  if (theil > lnN) theil = lnN;
  const theilNorm = lnN > 0 ? theil / lnN : 0;
  const topShareMax = sum > 0 ? mx / sum : 0;
  return {
    nShared: n,
    meanHalfWidth: mean,
    minHalfWidth: mn,
    maxHalfWidth: mx,
    lnN,
    shannonEntropy: H,
    theil,
    theilNorm,
    topShareMax,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

export function buildSourceRowTokenSlopeCiLensWidthTheil(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthTheilOptions = {},
): SourceRowTokenSlopeCiLensWidthTheilReport {
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
  const alertTheil = opts.alertTheil ?? null;
  if (alertTheil !== null) {
    if (!Number.isFinite(alertTheil) || alertTheil < 0) {
      throw new Error(
        `alertTheil must be a finite, non-negative number (got ${opts.alertTheil})`,
      );
    }
  }
  const alertTheilNorm = opts.alertTheilNorm ?? null;
  if (alertTheilNorm !== null) {
    if (
      !Number.isFinite(alertTheilNorm) ||
      alertTheilNorm < 0 ||
      alertTheilNorm > 1
    ) {
      throw new Error(
        `alertTheilNorm must be a finite number in [0, 1] (got ${opts.alertTheilNorm})`,
      );
    }
  }
  const sort = opts.sort ?? 'theil-desc';
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
  const lensReports: Record<SlopeLensWidthTheilLensName, Map<string, PerLensRaw>> = {
    bootstrap: new Map(bootstrapReport.sources.map((r) => [r.source, r])),
    jackknife: new Map(jackknifeReport.sources.map((r) => [r.source, r])),
    bca: new Map(bcaReport.sources.map((r) => [r.source, r])),
    studentizedT: new Map(studReport.sources.map((r) => [r.source, r])),
    abc: new Map(abcReport.sources.map((r) => [r.source, r])),
    profileLikelihood: new Map(profileReport.sources.map((r) => [r.source, r])),
  };

  const allSources = new Set<string>();
  for (const lens of SLOPE_LENS_WIDTH_THEIL_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_THEIL_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthTheilLensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_THEIL_LENS_NAMES) {
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const halfW = (hi - lo) / 2;
      halfs.push(halfW);
    }
    const computed = lensWidthTheil(halfs);
    const concentrationLabel = classifyConcentration(
      computed.theilNorm,
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
  const theils = nonDegen.map((r) => r.theil);
  const theilNorms = nonDegen.map((r) => r.theilNorm);
  const meanTheil =
    theils.length > 0 ? theils.reduce((a, b) => a + b, 0) / theils.length : 0;
  const medianTheil = median(theils);
  const maxTheil = theils.length > 0 ? Math.max(...theils) : 0;
  const minTheil = theils.length > 0 ? Math.min(...theils) : 0;
  const rangeTheil = theils.length > 0 ? maxTheil - minTheil : 0;
  const meanTheilNorm =
    theilNorms.length > 0
      ? theilNorms.reduce((a, b) => a + b, 0) / theilNorms.length
      : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nHighlyConcentrated = rows.filter(
    (r) => r.concentrationLabel === 'highly-concentrated',
  ).length;
  const nNearEqual = rows.filter(
    (r) => r.concentrationLabel === 'near-equal',
  ).length;

  let mostConcentratedLens: SlopeLensWidthTheilLensName | null = null;
  let mostEqualLens: SlopeLensWidthTheilLensName | null = null;
  if (nonDegen.length > 0) {
    let bestHi = -Infinity;
    let bestLo = Infinity;
    for (const r of nonDegen) {
      if (r.theil > bestHi) {
        bestHi = r.theil;
        mostConcentratedLens = r.lens;
      }
      if (r.theil < bestLo) {
        bestLo = r.theil;
        mostEqualLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertTheil !== null) {
    filtered = filtered.filter((r) => r.theil > alertTheil);
  }
  if (alertTheilNorm !== null) {
    filtered = filtered.filter((r) => r.theilNorm > alertTheilNorm);
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthTheilLensRow,
      b: SourceRowTokenSlopeCiLensWidthTheilLensRow,
    ) => number
  > = {
    'theil-desc': (a, b) => b.theil - a.theil,
    'theil-asc': (a, b) => a.theil - b.theil,
    'theil-norm-desc': (a, b) => b.theilNorm - a.theilNorm,
    'mean-halfwidth-desc': (a, b) => b.meanHalfWidth - a.meanHalfWidth,
    'top-share-desc': (a, b) => b.topShareMax - a.topShareMax,
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_THEIL_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_THEIL_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_THEIL_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_THEIL_LENS_NAMES.indexOf(b.lens)
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
    alertTheil,
    alertTheilNorm,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    meanTheil,
    medianTheil,
    maxTheil,
    minTheil,
    rangeTheil,
    meanTheilNorm,
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

export function renderSourceRowTokenSlopeCiLensWidthTheil(
  r: SourceRowTokenSlopeCiLensWidthTheilReport,
  opts: {
    showSummary?: boolean;
    showConcentrationAggregate?: boolean;
    showLensAttribution?: boolean;
    showMoments?: boolean;
    showPerSourceWidths?: boolean;
    showShares?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showConcentrationAggregate = opts.showConcentrationAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showMoments = opts.showMoments ?? false;
  const showPerSourceWidths = opts.showPerSourceWidths ?? false;
  const showShares = opts.showShares ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-width-theil');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-theil: ${r.alertTheil ?? '-'}    alert-theil-norm: ${r.alertTheilNorm ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanTheil: ${fmtNum(r.meanTheil)}; medianTheil: ${fmtNum(r.medianTheil)}; maxTheil: ${fmtNum(r.maxTheil)}; minTheil: ${fmtNum(r.minTheil)}; rangeTheil: ${fmtNum(r.rangeTheil)}; meanTheilNorm: ${fmtNum(r.meanTheilNorm)}; nHighlyConcentrated: ${r.nHighlyConcentrated}; nNearEqual: ${r.nNearEqual}; nDegenerate: ${r.nDegenerate}; mostConcentrated: ${r.mostConcentratedLens ?? '-'}; mostEqual: ${r.mostEqualLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     theil    theilNorm  topShare  concentration            reason',
  );
  lines.push(
    '-----------------  ----  -------  ---------  --------  -----------------------  -----------------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        fmtNum(row.theil).padStart(7),
        fmtNum(row.theilNorm).padStart(9),
        fmtNum(row.topShareMax).padStart(8),
        row.concentrationLabel.padEnd(23),
        (row.degenerateReason ?? '-').padEnd(23),
      ].join('  '),
    );
    if (showSummary) {
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} theil=${fmtNum(row.theil)} theilNorm=${fmtNum(row.theilNorm)} topShare=${fmtNum(row.topShareMax)} concentration=${row.concentrationLabel}`,
      );
    }
    if (showMoments) {
      lines.push(
        `    moments: meanHalf=${fmtNum(row.meanHalfWidth, 6)} minHalf=${fmtNum(row.minHalfWidth, 6)} maxHalf=${fmtNum(row.maxHalfWidth, 6)} lnN=${fmtNum(row.lnN, 6)} shannonH=${fmtNum(row.shannonEntropy, 6)}`,
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
    if (showShares) {
      // Per-source shares p_i = x_i / sum(x_j) and their
      // contribution to the Theil sum p_i * ln(n * p_i). The
      // sum of contribs equals theil exactly (modulo floating-
      // point), giving an audit trail per source: which source
      // is doing the bulk of the lifting in the inequality
      // measure.
      const halfs = row.perSourceHalfWidths;
      const total = halfs.reduce((a, b) => a + b, 0);
      if (halfs.length === 0) {
        lines.push(`    shares: (no shared sources)`);
      } else if (total === 0) {
        lines.push(`    shares: (zero-mean -- shares undefined)`);
      } else {
        const n = halfs.length;
        const lnN = Math.log(n);
        const parts: string[] = [];
        for (let i = 0; i < n; i++) {
          const x = halfs[i]!;
          const p = x / total;
          let contrib = 0;
          if (p > 0) contrib = p * (Math.log(p) + lnN);
          parts.push(
            `${row.perSourceSources[i]}=p:${fmtNum(p, 4)}/c:${fmtNum(contrib, 4)}`,
          );
        }
        lines.push(`    shares: ${parts.join(' ')}`);
      }
    }
  }
  if (showConcentrationAggregate && r.rows.length > 0) {
    const denom = r.rows.length;
    lines.push(
      `[concentration aggregate] nHighlyConcentrated=${r.nHighlyConcentrated}/${denom} (${fmtNum(r.nHighlyConcentrated / denom, 4)}) nNearEqual=${r.nNearEqual}/${denom} (${fmtNum(r.nNearEqual / denom, 4)}) nDegenerate=${r.nDegenerate}/${denom} (${fmtNum(r.nDegenerate / denom, 4)}) meanTheil=${fmtNum(r.meanTheil)} medianTheil=${fmtNum(r.medianTheil)} rangeTheil=${fmtNum(r.rangeTheil)} meanTheilNorm=${fmtNum(r.meanTheilNorm)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostConcentrated=${r.mostConcentratedLens ?? '-'} (max theil) mostEqual=${r.mostEqualLens ?? '-'} (min theil)`,
    );
  }
  return lines.join('\n');
}
