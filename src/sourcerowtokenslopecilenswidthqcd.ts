/**
 * source-row-token-slope-ci-lens-width-qcd
 *
 * Per-lens CROSS-SOURCE QUARTILE COEFFICIENT OF DISPERSION (QCD)
 * of CI half-widths (TWENTY-FOURTH cross-lens axis) for the
 * v0.6.219 Deming-slope uncertainty-quantification suite.
 * Consumes the SAME six per-source slope CIs as v0.6.227-v0.6.250
 * (percentile bootstrap, jackknife normal, BCa, studentized-t,
 * ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL TWENTY-THREE prior cross-lens
 * diagnostics on FIVE orthogonal dimensions:
 *
 *   1. POPULATION GEOMETRY (vs axes 1-19). Like axes 20-23, the
 *      report is INDEXED BY LENS (six rows). Axes 1-19 reduce a
 *      6-vector per source to a per-source scalar; this axis
 *      reduces the across-source cloud for each fixed lens to a
 *      single scalar.
 *
 *   2. STATISTIC FAMILY (vs all 1-23). QCD is an ORDER-STATISTIC,
 *      ROBUST, NON-PARAMETRIC dispersion measure defined purely
 *      from the lower and upper quartiles (Q1, Q3) of the
 *      cross-source half-width cloud:
 *
 *        QCD = (Q3 - Q1) / (Q3 + Q1)
 *
 *      Bonett (2006); Kirby (1974). Bounded in [0, 1] for any
 *      non-negative population with Q3 > 0. Scale-invariant. NOT
 *      a Pearson r (axis-20), NOT Gini's Lorenz-area (axis-21),
 *      NOT Theil's entropic deviation (axis-22), NOT Atkinson's
 *      CRRA welfare loss (axis-23). All axes 20-23 are functions
 *      of the FULL n-vector via central moments, log-ratios, or
 *      power means; QCD is a function of EXACTLY TWO order
 *      statistics.
 *
 *   3. BREAKDOWN POINT (vs all 1-23). QCD has the HIGHEST finite-
 *      sample breakdown point of any cross-lens dispersion shipped:
 *      ~25% (a quarter of sources can be replaced with arbitrary
 *      values without changing Q1 or Q3). Axes 20-23 all have
 *      breakdown 0 (a single extreme half-width can dominate the
 *      mean-based statistic). This makes QCD the canonical
 *      diagnostic for "is one-or-two outlier sources driving the
 *      apparent inequality, or is the inequality structural?"
 *
 *   4. ZERO-IMMUNITY (vs axes 22 and 23). Theil GE(1) requires
 *      every source > 0 (logarithm); Atkinson at eps>=1 collapses
 *      to A=1 if ANY source is exactly 0. QCD requires only that
 *      Q3 > 0 -- up to floor(n/2) sources can be exactly zero
 *      (every CI collapsed to a point) without any degeneracy.
 *      The same input that flips axis-23 into 'zero-source-eps-ge-1'
 *      degeneracy can yield a perfectly informative QCD.
 *
 *   5. INTERQUARTILE FOOTPRINT (vs axis-19 IQR-RATIO of row tokens).
 *      The pre-existing per-source axis `source-row-token-iqr-ratio`
 *      (v0.6.95) computes IQR/median over WITHIN-source row tokens
 *      and reduces to a per-SOURCE scalar; this axis computes
 *      QCD = (Q3-Q1)/(Q3+Q1) over CROSS-source CI half-widths
 *      and reduces to a per-LENS scalar. Different population
 *      (rows-of-one-source vs sources-of-one-lens), different
 *      observable (token counts vs slope CI widths), different
 *      normaliser (median vs sum-of-quartiles).
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.250. For each lens L:
 *
 *   For each source s in S (sources present in ALL six lens
 *   reports):
 *     halfWidth_{L,s} = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *
 *   Sort the n half-widths ascending. Compute Q1 and Q3 by the
 *   linear-interpolation method (Hyndman-Fan type 7, the default
 *   in numpy.quantile and R's quantile() type=7):
 *
 *     For p in {0.25, 0.75}:
 *       h     = (n - 1) * p
 *       lo    = floor(h)
 *       hi    = ceil(h)
 *       frac  = h - lo
 *       Q_p   = sorted[lo] + frac * (sorted[hi] - sorted[lo])
 *
 *   QCD = (Q3 - Q1) / (Q3 + Q1)
 *
 *   Edge cases:
 *     - n < 4 (cannot define Q1 and Q3 with at least one
 *       observation strictly between them): QCD = 0,
 *       degenerateFlag = true, reason = 'too-few-sources'.
 *     - Q3 = 0 (at least 75% of sources have a half-width of
 *       zero): QCD = 0, degenerateFlag = true, reason =
 *       'zero-q3'. (Q1 must also be 0 in this case, so the
 *       cloud is essentially degenerate.)
 *     - Q3 - Q1 < 0 due to floating point: clamped to 0.
 *     - Any half-width is negative or non-finite: throws.
 *
 *   Numerical safety: the result is clamped into [0, 1].
 *
 * Per-lens columns:
 *   - `lens`          — canonical lens name
 *   - `nShared`       — number of shared sources used
 *   - `medianHalfWidth` — median (Q2) of half-widths across sources
 *   - `q1HalfWidth`   — first quartile (Q1)
 *   - `q3HalfWidth`   — third quartile (Q3)
 *   - `iqrHalfWidth`  — Q3 - Q1
 *   - `qcd`           — quartile coefficient of dispersion
 *   - `dispersionLabel` — qualitative bin on QCD:
 *                          'highly-dispersed'   (QCD >  0.5)
 *                          'moderately-dispersed' (QCD in (0.3, 0.5])
 *                          'mild-dispersion'    (QCD in (0.1, 0.3])
 *                          'near-uniform'       (QCD in [0,   0.1])
 *                          'degenerate'         (degenerateFlag)
 *   - `degenerateFlag`   — true iff hit an edge case
 *   - `degenerateReason` — reason string, or null
 *
 * Report-level:
 *   - meanQcd          — mean of non-degenerate QCD values
 *   - medianQcd        — median of non-degenerate QCD values
 *   - maxQcd, minQcd, rangeQcd
 *   - nDegenerate      — # lenses with degenerateFlag
 *   - nHighlyDispersed — # lenses with QCD > 0.5
 *   - nNearUniform     — # lenses with QCD <= 0.1
 *   - mostDispersedLens  — argmax_L QCD (canonical tie-break)
 *   - mostUniformLens    — argmin_L QCD (canonical tie-break)
 *
 * Filters:
 *   - --alert-qcd <f>  — keep lenses with QCD > f (f in [0, 1])
 *   - --alert-iqr <f>  — keep lenses with IQR > f (f >= 0)
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_QCD_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthQcdLensName =
  (typeof SLOPE_LENS_WIDTH_QCD_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 4;
const HIGH_THRESHOLD = 0.5;
const MODERATE_THRESHOLD = 0.3;
const NEAR_UNIFORM_THRESHOLD = 0.1;

export type QcdDegenerateReason =
  | 'too-few-sources'
  | 'zero-q3'
  | 'non-finite';

export type QcdDispersionLabel =
  | 'highly-dispersed'
  | 'moderately-dispersed'
  | 'mild-dispersion'
  | 'near-uniform'
  | 'degenerate';

export interface SourceRowTokenSlopeCiLensWidthQcdOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertQcd?: number | null;
  alertIqr?: number | null;
  sort?:
    | 'qcd-desc'
    | 'qcd-asc'
    | 'iqr-desc'
    | 'median-halfwidth-desc'
    | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthQcdLensRow {
  lens: SlopeLensWidthQcdLensName;
  nShared: number;
  medianHalfWidth: number;
  q1HalfWidth: number;
  q3HalfWidth: number;
  iqrHalfWidth: number;
  qcd: number;
  dispersionLabel: QcdDispersionLabel;
  degenerateFlag: boolean;
  degenerateReason: QcdDegenerateReason | null;
  perSourceHalfWidths: number[];
  perSourceSources: string[];
}

export interface SourceRowTokenSlopeCiLensWidthQcdReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertQcd: number | null;
  alertIqr: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiLensWidthQcdOptions['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  meanQcd: number;
  medianQcd: number;
  maxQcd: number;
  minQcd: number;
  rangeQcd: number;
  nDegenerate: number;
  nHighlyDispersed: number;
  nNearUniform: number;
  mostDispersedLens: SlopeLensWidthQcdLensName | null;
  mostUniformLens: SlopeLensWidthQcdLensName | null;
  rows: SourceRowTokenSlopeCiLensWidthQcdLensRow[];
}

const VALID_SORTS = [
  'qcd-desc',
  'qcd-asc',
  'iqr-desc',
  'median-halfwidth-desc',
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
 * Hyndman-Fan type 7 quantile (numpy / R default). Requires a
 * pre-sorted ascending array of length >= 1.
 */
function quantileType7(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0]!;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sorted[lo]!;
  const frac = h - lo;
  return sorted[lo]! + frac * (sorted[hi]! - sorted[lo]!);
}

function classifyDispersion(
  qcd: number,
  degenerate: boolean,
): QcdDispersionLabel {
  if (degenerate) return 'degenerate';
  if (qcd > HIGH_THRESHOLD) return 'highly-dispersed';
  if (qcd > MODERATE_THRESHOLD) return 'moderately-dispersed';
  if (qcd > NEAR_UNIFORM_THRESHOLD) return 'mild-dispersion';
  return 'near-uniform';
}

/**
 * Compute QCD = (Q3 - Q1) / (Q3 + Q1) on a single set of
 * non-negative half-widths.
 *
 * Returns degenerate metadata for the standard edge cases.
 *
 * Exposed for direct unit-testing.
 */
export function lensWidthQcd(halfWidths: number[]): {
  nShared: number;
  medianHalfWidth: number;
  q1HalfWidth: number;
  q3HalfWidth: number;
  iqrHalfWidth: number;
  qcd: number;
  degenerateFlag: boolean;
  degenerateReason: QcdDegenerateReason | null;
} {
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(`lensWidthQcd: halfWidths must be finite (got ${v})`);
    }
    if (v < 0) {
      throw new Error(
        `lensWidthQcd: halfWidths must be non-negative (got ${v})`,
      );
    }
  }
  const n = halfWidths.length;
  if (n < MIN_SHARED_SOURCES) {
    return {
      nShared: n,
      medianHalfWidth: 0,
      q1HalfWidth: 0,
      q3HalfWidth: 0,
      iqrHalfWidth: 0,
      qcd: 0,
      degenerateFlag: true,
      degenerateReason: 'too-few-sources',
    };
  }
  const sorted = [...halfWidths].sort((a, b) => a - b);
  const q1 = quantileType7(sorted, 0.25);
  const q2 = quantileType7(sorted, 0.5);
  const q3 = quantileType7(sorted, 0.75);
  let iqr = q3 - q1;
  if (iqr < 0) iqr = 0; // floating-point clamp
  if (q3 === 0) {
    return {
      nShared: n,
      medianHalfWidth: q2,
      q1HalfWidth: q1,
      q3HalfWidth: q3,
      iqrHalfWidth: 0,
      qcd: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-q3',
    };
  }
  const denom = q3 + q1;
  if (denom <= 0 || !Number.isFinite(denom)) {
    return {
      nShared: n,
      medianHalfWidth: q2,
      q1HalfWidth: q1,
      q3HalfWidth: q3,
      iqrHalfWidth: iqr,
      qcd: 0,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  let qcd = iqr / denom;
  if (!Number.isFinite(qcd)) {
    return {
      nShared: n,
      medianHalfWidth: q2,
      q1HalfWidth: q1,
      q3HalfWidth: q3,
      iqrHalfWidth: iqr,
      qcd: 0,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  if (qcd < 0) qcd = 0;
  if (qcd > 1) qcd = 1;
  return {
    nShared: n,
    medianHalfWidth: q2,
    q1HalfWidth: q1,
    q3HalfWidth: q3,
    iqrHalfWidth: iqr,
    qcd,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

export function buildSourceRowTokenSlopeCiLensWidthQcd(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthQcdOptions = {},
): SourceRowTokenSlopeCiLensWidthQcdReport {
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
  const alertQcd = opts.alertQcd ?? null;
  if (alertQcd !== null) {
    if (!Number.isFinite(alertQcd) || alertQcd < 0 || alertQcd > 1) {
      throw new Error(
        `alertQcd must be a finite number in [0, 1] (got ${opts.alertQcd})`,
      );
    }
  }
  const alertIqr = opts.alertIqr ?? null;
  if (alertIqr !== null) {
    if (!Number.isFinite(alertIqr) || alertIqr < 0) {
      throw new Error(
        `alertIqr must be a finite, non-negative number (got ${opts.alertIqr})`,
      );
    }
  }
  const sort = opts.sort ?? 'qcd-desc';
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
    SlopeLensWidthQcdLensName,
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
  for (const lens of SLOPE_LENS_WIDTH_QCD_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_QCD_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthQcdLensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_QCD_LENS_NAMES) {
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const halfW = (hi - lo) / 2;
      halfs.push(halfW);
    }
    const comp = lensWidthQcd(halfs);
    const dispersionLabel = classifyDispersion(comp.qcd, comp.degenerateFlag);
    rows.push({
      lens,
      nShared: comp.nShared,
      medianHalfWidth: comp.medianHalfWidth,
      q1HalfWidth: comp.q1HalfWidth,
      q3HalfWidth: comp.q3HalfWidth,
      iqrHalfWidth: comp.iqrHalfWidth,
      qcd: comp.qcd,
      dispersionLabel,
      degenerateFlag: comp.degenerateFlag,
      degenerateReason: comp.degenerateReason,
      perSourceHalfWidths: halfs,
      perSourceSources: [...sharedSources],
    });
  }

  const nonDegen = rows.filter((r) => !r.degenerateFlag);
  const qcds = nonDegen.map((r) => r.qcd);
  const meanQcd =
    qcds.length > 0 ? qcds.reduce((a, b) => a + b, 0) / qcds.length : 0;
  const medianQcd = median(qcds);
  const maxQcd = qcds.length > 0 ? Math.max(...qcds) : 0;
  const minQcd = qcds.length > 0 ? Math.min(...qcds) : 0;
  const rangeQcd = qcds.length > 0 ? maxQcd - minQcd : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nHighlyDispersed = rows.filter(
    (r) => r.dispersionLabel === 'highly-dispersed',
  ).length;
  const nNearUniform = rows.filter(
    (r) => r.dispersionLabel === 'near-uniform',
  ).length;

  let mostDispersedLens: SlopeLensWidthQcdLensName | null = null;
  let mostUniformLens: SlopeLensWidthQcdLensName | null = null;
  if (nonDegen.length > 0) {
    let bestHi = -Infinity;
    let bestLo = Infinity;
    for (const r of nonDegen) {
      if (r.qcd > bestHi) {
        bestHi = r.qcd;
        mostDispersedLens = r.lens;
      }
      if (r.qcd < bestLo) {
        bestLo = r.qcd;
        mostUniformLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertQcd !== null) {
    filtered = filtered.filter((r) => r.qcd > alertQcd);
  }
  if (alertIqr !== null) {
    filtered = filtered.filter((r) => r.iqrHalfWidth > alertIqr);
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthQcdLensRow,
      b: SourceRowTokenSlopeCiLensWidthQcdLensRow,
    ) => number
  > = {
    'qcd-desc': (a, b) => b.qcd - a.qcd,
    'qcd-asc': (a, b) => a.qcd - b.qcd,
    'iqr-desc': (a, b) => b.iqrHalfWidth - a.iqrHalfWidth,
    'median-halfwidth-desc': (a, b) => b.medianHalfWidth - a.medianHalfWidth,
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_QCD_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_QCD_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_QCD_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_QCD_LENS_NAMES.indexOf(b.lens)
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
    alertQcd,
    alertIqr,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    meanQcd,
    medianQcd,
    maxQcd,
    minQcd,
    rangeQcd,
    nDegenerate,
    nHighlyDispersed,
    nNearUniform,
    mostDispersedLens,
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

export function renderSourceRowTokenSlopeCiLensWidthQcd(
  r: SourceRowTokenSlopeCiLensWidthQcdReport,
  opts: {
    showSummary?: boolean;
    showDispersionAggregate?: boolean;
    showLensAttribution?: boolean;
    showQuartiles?: boolean;
    showPerSourceWidths?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showDispersionAggregate = opts.showDispersionAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showQuartiles = opts.showQuartiles ?? false;
  const showPerSourceWidths = opts.showPerSourceWidths ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-width-qcd');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-qcd: ${r.alertQcd ?? '-'}    alert-iqr: ${r.alertIqr ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanQCD: ${fmtNum(r.meanQcd)}; medianQCD: ${fmtNum(r.medianQcd)}; maxQCD: ${fmtNum(r.maxQcd)}; minQCD: ${fmtNum(r.minQcd)}; rangeQCD: ${fmtNum(r.rangeQcd)}; nHighlyDispersed: ${r.nHighlyDispersed}; nNearUniform: ${r.nNearUniform}; nDegen: ${r.nDegenerate}; mostDispersed: ${r.mostDispersedLens ?? '-'}; mostUniform: ${r.mostUniformLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     QCD      IQR        median     Q1         Q3         dispersion             reason',
  );
  lines.push(
    '-----------------  ----  -------  ---------  ---------  ---------  ---------  ---------------------  ---------------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        fmtNum(row.qcd).padStart(7),
        fmtNum(row.iqrHalfWidth, 6).padStart(9),
        fmtNum(row.medianHalfWidth, 6).padStart(9),
        fmtNum(row.q1HalfWidth, 6).padStart(9),
        fmtNum(row.q3HalfWidth, 6).padStart(9),
        row.dispersionLabel.padEnd(21),
        (row.degenerateReason ?? '-').padEnd(21),
      ].join('  '),
    );
    if (showSummary) {
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} QCD=${fmtNum(row.qcd)} IQR=${fmtNum(row.iqrHalfWidth, 6)} dispersion=${row.dispersionLabel}`,
      );
    }
    if (showQuartiles) {
      lines.push(
        `    quartiles: Q1=${fmtNum(row.q1HalfWidth, 6)} median=${fmtNum(row.medianHalfWidth, 6)} Q3=${fmtNum(row.q3HalfWidth, 6)} IQR=${fmtNum(row.iqrHalfWidth, 6)}`,
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
  if (showDispersionAggregate && r.rows.length > 0) {
    const denom = r.rows.length;
    lines.push(
      `[dispersion aggregate] nHighlyDispersed=${r.nHighlyDispersed}/${denom} (${fmtNum(r.nHighlyDispersed / denom, 4)}) nNearUniform=${r.nNearUniform}/${denom} (${fmtNum(r.nNearUniform / denom, 4)}) nDegen=${r.nDegenerate}/${denom} (${fmtNum(r.nDegenerate / denom, 4)}) meanQCD=${fmtNum(r.meanQcd)} medianQCD=${fmtNum(r.medianQcd)} rangeQCD=${fmtNum(r.rangeQcd)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostDispersed=${r.mostDispersedLens ?? '-'} (max QCD) mostUniform=${r.mostUniformLens ?? '-'} (min QCD)`,
    );
  }
  return lines.join('\n');
}
