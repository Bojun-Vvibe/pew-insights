/**
 * source-row-token-slope-ci-half-width-logratio-variance
 *
 * Per-source CI HALF-WIDTH PAIRWISE LOG-RATIO VARIANCE diagnostic
 * (NINETEENTH cross-lens axis) for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six
 * per-source slope CIs as v0.6.227-v0.6.245 (percentile bootstrap,
 * jackknife normal, BCa, studentized-t, ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL EIGHTEEN prior cross-lens
 * diagnostics on TWO orthogonal dimensions:
 *
 *   1. STATISTIC FAMILY. Axes 1-13 are moment / quantile / order-
 *      statistic / dispersion of MIDPOINTS. Axes 14 (single-lens
 *      identifier), the rank-correlation axes (Spearman, Kendall,
 *      width-concordance) are rank-based. Axes 15-17 are curvature
 *      / monotone-fit / tail-asymmetry. Axis 18 is information-
 *      theoretic (Shannon entropy of normalised half-widths,
 *      treating them as a probability mass on the simplex).
 *
 *      This axis is COMPOSITIONAL: it lives in Aitchison geometry
 *      on the (N-1)-simplex of normalised half-widths and measures
 *      pairwise LOG-RATIO VARIANCE — the canonical Aitchison
 *      dispersion of a composition. Equivalently, it is the
 *      variance of the centred-log-ratio (CLR) coordinates of the
 *      half-width vector, scaled by N/(N-1). This is a fundamen-
 *      tally different geometry from Shannon entropy: entropy
 *      measures distance from the uniform vertex of the simplex
 *      via the H-functional; log-ratio variance measures isotropic
 *      Aitchison-norm spread of the composition under the
 *      log-ratio metric. Two compositions can have IDENTICAL
 *      Shannon entropy yet ARBITRARILY different log-ratio
 *      variance, and vice versa.
 *
 *   2. INPUT TRANSFORM. Axis 18 normalises h_i to p_i = h_i / sum
 *      and applies p log p. This axis applies log(h_i) directly
 *      (or equivalently, log(p_i) since the simplex constraint
 *      cancels in pairwise differences). It is INVARIANT to
 *      multiplication of all half-widths by a positive scalar
 *      (sub-compositional / scale invariance), unlike axis 18
 *      whose effLenses depends on the absolute distribution shape
 *      but whose entropy is also scale-invariant on the simplex
 *      yet still uses a fundamentally different functional.
 *
 * The diagnostic — for each source s with six half-widths h_i:
 *
 *   Define eligibility:
 *     positiveCount  = #{ i : h_i > 0 }
 *     degenerateFlag = positiveCount < 2
 *
 *   For non-degenerate sources (positiveCount >= 2) restricted to
 *   the lenses with h_i > 0 (call this index set S, |S| = K):
 *
 *     For every UNORDERED pair (i, j) with i < j, i, j in S:
 *       r_{ij} = log(h_i) - log(h_j)            (natural log)
 *
 *     pairsCount       = K * (K - 1) / 2
 *     logRatioMean     = (1 / pairsCount) *
 *                        sum_{i<j in S} r_{ij}
 *                        (empirical mean of unordered pairwise
 *                        log-ratios; vanishes only when all logH_i
 *                        are equal — surfaced for self-check)
 *     logRatioVariance = (1 / pairsCount) *
 *                        sum_{i<j in S} (r_{ij} - logRatioMean)^2
 *                        (population variance of pairwise
 *                        log-ratios; Aitchison logratio variance)
 *     logRatioStdDev   = sqrt(logRatioVariance)
 *     maxAbsLogRatio   = max_{i<j in S} |r_{ij}|         (Aitchison
 *                        L-infinity norm; the geometric ratio
 *                        between the widest and narrowest CI)
 *     clrCoords        = log(h_i) - mean_{j in S} log(h_j) for
 *                        i in S (zero elsewhere by convention)
 *     clrVariance      = (1 / K) * sum_{i in S} clrCoords[i]^2
 *                        (population variance of CLR coordinates)
 *
 *   Both `logRatioVariance` (pairwise log-ratio dispersion) and
 *   `clrVariance` (CLR-coordinate dispersion) are reported. They
 *   measure the SAME compositional dispersion through two
 *   classical Aitchison parametrisations and are surfaced
 *   side-by-side as numerical self-checks.
 *
 *   For degenerate sources (positiveCount < 2 — at most one lens
 *   has positive half-width), pairwise log-ratios are undefined.
 *   We report logRatioVariance = 0, logRatioStdDev = 0,
 *   maxAbsLogRatio = 0, clrVariance = 0, pairsCount = 0,
 *   degenerateFlag = true. This is a CONSCIOUS choice that maps
 *   "no compositional information" to "zero compositional spread";
 *   downstream consumers can filter by degenerateFlag to exclude.
 *
 * Per-source columns:
 *   - `halfWidths`        — six half-widths in canonical order
 *   - `positiveCount`     — # lenses with h_i > 0
 *   - `pairsCount`        — K*(K-1)/2
 *   - `logRatioMean`      — population mean of pairwise r_{ij}
 *                            (== 0 by construction; reported for
 *                            self-check)
 *   - `logRatioVariance`  — Aitchison log-ratio variance
 *   - `logRatioStdDev`    — sqrt of above
 *   - `maxAbsLogRatio`    — Aitchison L-infinity norm
 *   - `clrVariance`       — population variance of CLR coords
 *   - `widestLens`        — argmax_i h_i restricted to S, canonical
 *                            tie-break
 *   - `narrowestLens`     — argmin_i h_i restricted to S, canonical
 *                            tie-break
 *   - `degenerateFlag`    — positiveCount < 2
 *
 * Report-level:
 *   - meanLogRatioVariance, medianLogRatioVariance
 *   - meanLogRatioStdDev
 *   - meanMaxAbsLogRatio
 *   - nDegenerate
 *   - nNearIsotropic   (logRatioVariance <= 0.01)
 *   - nHighlyDispersed (logRatioVariance >= 1.00)
 *   - globalWidestLens / globalNarrowestLens  (mode across
 *     non-degenerate sources, canonical tie-break)
 *
 * Filters:
 *   - --alert-variance  <f>   : keep sources with
 *                                logRatioVariance > f
 *   - --alert-max-ratio <f>   : keep sources with
 *                                maxAbsLogRatio   > f
 *
 * Threshold rationale:
 *   - 0.01 nat^2 ≈ stdDev of 0.10 nats ≈ 10% multiplicative
 *     spread between the widest and narrowest CI. Sources below
 *     this are essentially isotropic in CI half-width.
 *   - 1.00 nat^2 ≈ stdDev of 1 nat ≈ a factor of e (~2.7×) typical
 *     spread; max-ratio of e^2 between the widest and narrowest
 *     pair. This flags sources where the six lenses disagree
 *     about CI width by orders of magnitude.
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_HALFWIDTH_LRV_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeHalfWidthLrvLensName =
  (typeof SLOPE_HALFWIDTH_LRV_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_HALFWIDTH_LRV_LENS_NAMES.length;
const NEAR_ISOTROPIC_THRESHOLD = 0.01;
const HIGHLY_DISPERSED_THRESHOLD = 1.0;

export interface SourceRowTokenSlopeCiHalfWidthLogRatioVarianceOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertVariance?: number | null;
  alertMaxRatio?: number | null;
  top?: number | null;
  sort?:
    | 'variance-desc'
    | 'variance-asc'
    | 'stddev-desc'
    | 'stddev-asc'
    | 'max-ratio-desc'
    | 'max-ratio-asc'
    | 'clr-variance-desc'
    | 'positive-count-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiHalfWidthLogRatioVarianceRow {
  source: string;
  rowsKept: number;
  halfWidths: number[];
  positiveCount: number;
  pairsCount: number;
  logRatioMean: number;
  logRatioVariance: number;
  logRatioStdDev: number;
  maxAbsLogRatio: number;
  clrVariance: number;
  widestLens: SlopeHalfWidthLrvLensName | null;
  narrowestLens: SlopeHalfWidthLrvLensName | null;
  degenerateFlag: boolean;
}

export interface SourceRowTokenSlopeCiHalfWidthLogRatioVarianceReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertVariance: number | null;
  alertMaxRatio: number | null;
  top: number | null;
  sort: NonNullable<
    SourceRowTokenSlopeCiHalfWidthLogRatioVarianceOptions['sort']
  >;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedAboveAlert: number;
  meanLogRatioVariance: number;
  medianLogRatioVariance: number;
  meanLogRatioStdDev: number;
  meanMaxAbsLogRatio: number;
  nDegenerate: number;
  nNearIsotropic: number;
  nHighlyDispersed: number;
  globalWidestLens: SlopeHalfWidthLrvLensName | null;
  globalNarrowestLens: SlopeHalfWidthLrvLensName | null;
  rows: SourceRowTokenSlopeCiHalfWidthLogRatioVarianceRow[];
}

const VALID_SORTS = [
  'variance-desc',
  'variance-asc',
  'stddev-desc',
  'stddev-asc',
  'max-ratio-desc',
  'max-ratio-asc',
  'clr-variance-desc',
  'positive-count-desc',
  'rows',
  'source',
] as const;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[m]!;
  return (s[m - 1]! + s[m]!) / 2;
}

/**
 * Pure helper: given six half-widths in CANONICAL lens order,
 * compute the pairwise log-ratio variance diagnostic. Exposed
 * for direct unit-testing.
 */
export function halfWidthLogRatioVariance(halfWidths: number[]): {
  halfWidths: number[];
  positiveCount: number;
  pairsCount: number;
  logRatioMean: number;
  logRatioVariance: number;
  logRatioStdDev: number;
  maxAbsLogRatio: number;
  clrVariance: number;
  widestLens: SlopeHalfWidthLrvLensName | null;
  narrowestLens: SlopeHalfWidthLrvLensName | null;
  degenerateFlag: boolean;
} {
  if (halfWidths.length !== N_LENSES) {
    throw new Error(
      `halfWidthLogRatioVariance: expected ${N_LENSES} half-widths (got ${halfWidths.length})`,
    );
  }
  for (const h of halfWidths) {
    if (!Number.isFinite(h)) {
      throw new Error(
        `halfWidthLogRatioVariance: half-widths must be finite (got ${h})`,
      );
    }
    if (h < 0) {
      throw new Error(
        `halfWidthLogRatioVariance: half-widths must be non-negative (got ${h})`,
      );
    }
  }

  // Eligible (positive) lens indices.
  const eligibleIdx: number[] = [];
  for (let i = 0; i < N_LENSES; i++) {
    if (halfWidths[i]! > 0) eligibleIdx.push(i);
  }
  const positiveCount = eligibleIdx.length;
  const degenerateFlag = positiveCount < 2;

  if (degenerateFlag) {
    let widestLens: SlopeHalfWidthLrvLensName | null = null;
    if (positiveCount === 1) {
      widestLens = SLOPE_HALFWIDTH_LRV_LENS_NAMES[eligibleIdx[0]!]!;
    }
    return {
      halfWidths,
      positiveCount,
      pairsCount: 0,
      logRatioMean: 0,
      logRatioVariance: 0,
      logRatioStdDev: 0,
      maxAbsLogRatio: 0,
      clrVariance: 0,
      widestLens,
      narrowestLens: widestLens,
      degenerateFlag,
    };
  }

  // Pairwise log-ratios over eligible lenses.
  const logH: number[] = eligibleIdx.map((i) => Math.log(halfWidths[i]!));
  const K = eligibleIdx.length;
  const pairsCount = (K * (K - 1)) / 2;
  let sumR = 0;
  let sumR2 = 0;
  let maxAbsR = 0;
  for (let a = 0; a < K; a++) {
    for (let b = a + 1; b < K; b++) {
      const r = logH[a]! - logH[b]!;
      sumR += r;
      sumR2 += r * r;
      const ar = Math.abs(r);
      if (ar > maxAbsR) maxAbsR = ar;
    }
  }
  // Empirical mean of pairwise log-ratios over unordered pairs.
  // Vanishes only when all logH_i are equal (i.e., all eligible
  // half-widths are identical); surfaced as a self-check column.
  const logRatioMean = pairsCount > 0 ? sumR / pairsCount : 0;
  // Population variance about the empirical mean.
  const meanSq = logRatioMean * logRatioMean;
  const logRatioVariance =
    pairsCount > 0 ? sumR2 / pairsCount - meanSq : 0;
  // Numerical safety.
  const lrvSafe = logRatioVariance < 0 ? 0 : logRatioVariance;
  const logRatioStdDev = Math.sqrt(lrvSafe);

  // CLR variance: variance of clr_i = logH_i - mean(logH) over
  // eligible lenses.
  let logHMean = 0;
  for (const v of logH) logHMean += v;
  logHMean /= K;
  let clrSumSq = 0;
  for (const v of logH) {
    const c = v - logHMean;
    clrSumSq += c * c;
  }
  const clrVariance = clrSumSq / K;

  // widestLens / narrowestLens restricted to eligible set.
  let widestI = eligibleIdx[0]!;
  let widestH = halfWidths[widestI]!;
  let narrowestI = eligibleIdx[0]!;
  let narrowestH = halfWidths[narrowestI]!;
  for (let k = 1; k < K; k++) {
    const idx = eligibleIdx[k]!;
    const h = halfWidths[idx]!;
    if (h > widestH) {
      widestH = h;
      widestI = idx;
    }
    if (h < narrowestH) {
      narrowestH = h;
      narrowestI = idx;
    }
  }

  return {
    halfWidths,
    positiveCount,
    pairsCount,
    logRatioMean,
    logRatioVariance: lrvSafe,
    logRatioStdDev,
    maxAbsLogRatio: maxAbsR,
    clrVariance,
    widestLens: SLOPE_HALFWIDTH_LRV_LENS_NAMES[widestI]!,
    narrowestLens: SLOPE_HALFWIDTH_LRV_LENS_NAMES[narrowestI]!,
    degenerateFlag,
  };
}

export function buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiHalfWidthLogRatioVarianceOptions = {},
): SourceRowTokenSlopeCiHalfWidthLogRatioVarianceReport {
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
  const alertVariance = opts.alertVariance ?? null;
  if (alertVariance !== null) {
    if (!Number.isFinite(alertVariance) || alertVariance < 0) {
      throw new Error(
        `alertVariance must be a finite non-negative number (got ${opts.alertVariance})`,
      );
    }
  }
  const alertMaxRatio = opts.alertMaxRatio ?? null;
  if (alertMaxRatio !== null) {
    if (!Number.isFinite(alertMaxRatio) || alertMaxRatio < 0) {
      throw new Error(
        `alertMaxRatio must be a finite non-negative number (got ${opts.alertMaxRatio})`,
      );
    }
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'variance-desc';
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
    SlopeHalfWidthLrvLensName,
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
  for (const lens of SLOPE_HALFWIDTH_LRV_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_HALFWIDTH_LRV_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiHalfWidthLogRatioVarianceRow[] = [];
  for (const s of sharedSources) {
    const halfWidths: number[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_HALFWIDTH_LRV_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      halfWidths.push((hi - lo) / 2);
    }
    const computed = halfWidthLogRatioVariance(halfWidths);
    rows.push({
      source: s,
      rowsKept,
      ...computed,
    });
  }

  const lrvs = rows.map((r) => r.logRatioVariance);
  const meanLogRatioVariance =
    lrvs.length > 0 ? lrvs.reduce((a, b) => a + b, 0) / lrvs.length : 0;
  const medianLogRatioVariance = median(lrvs);
  const sds = rows.map((r) => r.logRatioStdDev);
  const meanLogRatioStdDev =
    sds.length > 0 ? sds.reduce((a, b) => a + b, 0) / sds.length : 0;
  const maxs = rows.map((r) => r.maxAbsLogRatio);
  const meanMaxAbsLogRatio =
    maxs.length > 0 ? maxs.reduce((a, b) => a + b, 0) / maxs.length : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nNearIsotropic = rows.filter(
    (r) => !r.degenerateFlag && r.logRatioVariance <= NEAR_ISOTROPIC_THRESHOLD,
  ).length;
  const nHighlyDispersed = rows.filter(
    (r) => r.logRatioVariance >= HIGHLY_DISPERSED_THRESHOLD,
  ).length;

  let globalWidestLens: SlopeHalfWidthLrvLensName | null = null;
  let globalNarrowestLens: SlopeHalfWidthLrvLensName | null = null;
  const widestCounts = new Map<SlopeHalfWidthLrvLensName, number>();
  const narrowestCounts = new Map<SlopeHalfWidthLrvLensName, number>();
  for (const lens of SLOPE_HALFWIDTH_LRV_LENS_NAMES) {
    widestCounts.set(lens, 0);
    narrowestCounts.set(lens, 0);
  }
  for (const r of rows) {
    if (r.degenerateFlag) continue;
    if (r.widestLens != null) {
      widestCounts.set(r.widestLens, widestCounts.get(r.widestLens)! + 1);
    }
    if (r.narrowestLens != null) {
      narrowestCounts.set(
        r.narrowestLens,
        narrowestCounts.get(r.narrowestLens)! + 1,
      );
    }
  }
  let maxW = -1;
  let maxN = -1;
  for (const lens of SLOPE_HALFWIDTH_LRV_LENS_NAMES) {
    const cw = widestCounts.get(lens)!;
    if (cw > maxW) {
      maxW = cw;
      globalWidestLens = lens;
    }
    const cn = narrowestCounts.get(lens)!;
    if (cn > maxN) {
      maxN = cn;
      globalNarrowestLens = lens;
    }
  }
  // If no non-degenerate rows, both stay null.
  if (rows.length === 0 || rows.every((r) => r.degenerateFlag)) {
    globalWidestLens = null;
    globalNarrowestLens = null;
  }

  let droppedAboveAlert = 0;
  let filtered = rows;
  if (alertVariance !== null) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.logRatioVariance > alertVariance);
    droppedAboveAlert += before - filtered.length;
  }
  if (alertMaxRatio !== null) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.maxAbsLogRatio > alertMaxRatio);
    droppedAboveAlert += before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiHalfWidthLogRatioVarianceRow,
      b: SourceRowTokenSlopeCiHalfWidthLogRatioVarianceRow,
    ) => number
  > = {
    'variance-desc': (a, b) => b.logRatioVariance - a.logRatioVariance,
    'variance-asc': (a, b) => a.logRatioVariance - b.logRatioVariance,
    'stddev-desc': (a, b) => b.logRatioStdDev - a.logRatioStdDev,
    'stddev-asc': (a, b) => a.logRatioStdDev - b.logRatioStdDev,
    'max-ratio-desc': (a, b) => b.maxAbsLogRatio - a.maxAbsLogRatio,
    'max-ratio-asc': (a, b) => a.maxAbsLogRatio - b.maxAbsLogRatio,
    'clr-variance-desc': (a, b) => b.clrVariance - a.clrVariance,
    'positive-count-desc': (a, b) => b.positiveCount - a.positiveCount,
    rows: (a, b) => b.rowsKept - a.rowsKept,
    source: (a, b) => a.source.localeCompare(b.source),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return a.source.localeCompare(b.source);
  });
  if (top !== null) filtered = filtered.slice(0, top);

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
    alertVariance,
    alertMaxRatio,
    top,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    droppedAboveAlert,
    meanLogRatioVariance,
    medianLogRatioVariance,
    meanLogRatioStdDev,
    meanMaxAbsLogRatio,
    nDegenerate,
    nNearIsotropic,
    nHighlyDispersed,
    globalWidestLens,
    globalNarrowestLens,
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
export function renderSourceRowTokenSlopeCiHalfWidthLogRatioVariance(
  r: SourceRowTokenSlopeCiHalfWidthLogRatioVarianceReport,
  opts: {
    showSummary?: boolean;
    showVarianceAggregate?: boolean;
    showLensAttribution?: boolean;
    showHalfWidths?: boolean;
    showClrCoords?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showVarianceAggregate = opts.showVarianceAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showHalfWidths = opts.showHalfWidths ?? false;
  const showClrCoords = opts.showClrCoords ?? false;
  const lines: string[] = [];
  lines.push(
    'pew-insights source-row-token-slope-ci-half-width-logratio-variance',
  );
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-variance: ${r.alertVariance ?? '-'}    alert-max-ratio: ${r.alertMaxRatio ?? '-'}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedAboveAlert} filtered-by-alert; meanLRV: ${fmtNum(r.meanLogRatioVariance)}; medianLRV: ${fmtNum(r.medianLogRatioVariance)}; meanLRStdDev: ${fmtNum(r.meanLogRatioStdDev)}; meanMaxAbsLR: ${fmtNum(r.meanMaxAbsLogRatio)}; nNearIsotropic: ${r.nNearIsotropic}; nHighlyDispersed: ${r.nHighlyDispersed}; nDegenerate: ${r.nDegenerate}; globalWidestLens: ${r.globalWidestLens ?? '-'}; globalNarrowestLens: ${r.globalNarrowestLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  pos  pairs  LRV       LRStd     maxAbsLR  clrVar    widest             narrowest          flags',
  );
  lines.push(
    '---------------  ----  ---  -----  --------  --------  --------  --------  -----------------  -----------------  -----',
  );
  for (const row of r.rows) {
    const flags: string[] = [];
    if (row.degenerateFlag) flags.push('degen');
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        String(row.positiveCount).padStart(3),
        String(row.pairsCount).padStart(5),
        fmtNum(row.logRatioVariance).padStart(8),
        fmtNum(row.logRatioStdDev).padStart(8),
        fmtNum(row.maxAbsLogRatio).padStart(8),
        fmtNum(row.clrVariance).padStart(8),
        (row.widestLens ?? '-').padEnd(17),
        (row.narrowestLens ?? '-').padEnd(17),
        (flags.join(',') || '-').padEnd(5),
      ].join('  '),
    );
    if (showSummary) {
      const flagStr = flags.length > 0 ? ` (${flags.join(',')})` : '';
      lines.push(
        `    summary: widestLens=${row.widestLens ?? '-'} narrowestLens=${row.narrowestLens ?? '-'} LRV=${fmtNum(row.logRatioVariance)} LRStd=${fmtNum(row.logRatioStdDev)} maxAbsLR=${fmtNum(row.maxAbsLogRatio)}${flagStr}`,
      );
    }
    if (showHalfWidths) {
      const parts: string[] = [];
      for (let i = 0; i < SLOPE_HALFWIDTH_LRV_LENS_NAMES.length; i++) {
        parts.push(
          `${SLOPE_HALFWIDTH_LRV_LENS_NAMES[i]}=${fmtNum(row.halfWidths[i]!, 6)}`,
        );
      }
      lines.push(`    halfWidths: ${parts.join(' ')}`);
    }
    if (showClrCoords) {
      // Recompute CLR coordinates per canonical lens. For ineligible
      // (h_i == 0) lenses we report `-` since log(0) is undefined.
      // For degenerate sources (all metrics zero) we report all `-`.
      const parts: string[] = [];
      if (row.degenerateFlag || row.positiveCount === 0) {
        for (const lens of SLOPE_HALFWIDTH_LRV_LENS_NAMES) {
          parts.push(`${lens}=-`);
        }
      } else {
        let logSum = 0;
        let nElig = 0;
        for (const h of row.halfWidths) {
          if (h > 0) {
            logSum += Math.log(h);
            nElig += 1;
          }
        }
        const logMean = logSum / nElig;
        for (let i = 0; i < SLOPE_HALFWIDTH_LRV_LENS_NAMES.length; i++) {
          const h = row.halfWidths[i]!;
          if (h > 0) {
            const clr = Math.log(h) - logMean;
            parts.push(`${SLOPE_HALFWIDTH_LRV_LENS_NAMES[i]}=${fmtNum(clr, 6)}`);
          } else {
            parts.push(`${SLOPE_HALFWIDTH_LRV_LENS_NAMES[i]}=-`);
          }
        }
      }
      lines.push(`    clrCoords: ${parts.join(' ')}`);
    }
  }
  if (showVarianceAggregate && r.rows.length > 0) {
    const isoFrac = r.nNearIsotropic / r.rows.length;
    const dispFrac = r.nHighlyDispersed / r.rows.length;
    const degFrac = r.nDegenerate / r.rows.length;
    lines.push(
      `[variance aggregate] meanLRV=${fmtNum(r.meanLogRatioVariance)} medianLRV=${fmtNum(r.medianLogRatioVariance)} meanLRStdDev=${fmtNum(r.meanLogRatioStdDev)} meanMaxAbsLR=${fmtNum(r.meanMaxAbsLogRatio)} nNearIsotropic=${r.nNearIsotropic}/${r.rows.length} (${fmtNum(isoFrac, 4)}) nHighlyDispersed=${r.nHighlyDispersed}/${r.rows.length} (${fmtNum(dispFrac, 4)}) nDegenerate=${r.nDegenerate}/${r.rows.length} (${fmtNum(degFrac, 4)})`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    const widestC = new Map<SlopeHalfWidthLrvLensName, number>();
    const narrowestC = new Map<SlopeHalfWidthLrvLensName, number>();
    for (const lens of SLOPE_HALFWIDTH_LRV_LENS_NAMES) {
      widestC.set(lens, 0);
      narrowestC.set(lens, 0);
    }
    let nNonDegen = 0;
    for (const row of r.rows) {
      if (row.degenerateFlag) continue;
      nNonDegen += 1;
      if (row.widestLens != null) {
        widestC.set(row.widestLens, widestC.get(row.widestLens)! + 1);
      }
      if (row.narrowestLens != null) {
        narrowestC.set(
          row.narrowestLens,
          narrowestC.get(row.narrowestLens)! + 1,
        );
      }
    }
    const denom = nNonDegen > 0 ? nNonDegen : 1;
    const wParts: string[] = [];
    const nParts: string[] = [];
    for (const lens of SLOPE_HALFWIDTH_LRV_LENS_NAMES) {
      const cw = widestC.get(lens)!;
      const cn = narrowestC.get(lens)!;
      wParts.push(`${lens}=${cw}/${nNonDegen} (${fmtNum(cw / denom, 4)})`);
      nParts.push(`${lens}=${cn}/${nNonDegen} (${fmtNum(cn / denom, 4)})`);
    }
    lines.push(
      `[lens attribution: widest] ${wParts.join(' ')} globalWidestLens=${r.globalWidestLens ?? '-'}`,
    );
    lines.push(
      `[lens attribution: narrowest] ${nParts.join(' ')} globalNarrowestLens=${r.globalNarrowestLens ?? '-'}`,
    );
  }
  return lines.join('\n');
}
