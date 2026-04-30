/**
 * source-row-token-slope-ci-lens-width-mld
 *
 * Per-lens CROSS-SOURCE MEAN LOG DEVIATION (MLD, also known as
 * THEIL-L or GENERALISED ENTROPY GE(alpha=0)) of CI half-widths
 * (THIRTY-SECOND cross-lens axis) for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six
 * per-source slope CIs as v0.6.227-v0.6.265 (percentile bootstrap,
 * jackknife normal, BCa, studentized-t, ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL THIRTY-ONE prior cross-lens
 * diagnostics on the following ORTHOGONAL axes:
 *
 *   1. STATISTIC FAMILY. The MLD is the Generalized-Entropy index
 *      at parameter alpha = 0:
 *
 *        MLD = GE(0) = (1/n) * sum_i log(mean / x_i)
 *                    = log(mean) - mean(log(x_i))
 *                    = log(arithmetic_mean / geometric_mean)
 *
 *      It is the THIRD corner of the GE(alpha) family that
 *      v0.6.225 (axis-22 Theil-T = GE(1)) and v0.6.255
 *      (axis-27 GE(2) = half coefficient-of-variation^2) already
 *      occupy. ORTHOGONAL to those by construction:
 *
 *        - GE(0) MLD                : BOTTOM-TAIL sensitive
 *                                      (log(mean/x) -> +inf as
 *                                       x -> 0+; insensitive to
 *                                       transfers among large x)
 *        - GE(1) Theil-T (axis-22)  : EQUAL sensitivity per dollar
 *                                      (entropy-weighted)
 *        - GE(2)        (axis-27)   : TOP-TAIL sensitive
 *                                      (half * CV^2; squared-deviation)
 *
 *      The three indices satisfy the ranking-of-sensitivities
 *      identity that for any mean-preserving transfer of size
 *      delta from x_i to x_j with x_i < x_j, the marginal change
 *      in GE(alpha) at the bottom-most rank is monotone DECREASING
 *      in alpha. MLD is therefore the maximum-bottom-sensitivity
 *      member of the family that we ship; GE(2) is the maximum
 *      top-sensitivity member; Theil-T is the equal-weighted
 *      midpoint.
 *
 *   2. ORTHOGONAL TO EVERY PRIOR AXIS:
 *
 *        - axis-21 Gini        : Lorenz-gap-integral with uniform
 *                                rank kernel; bounded in [0, 1].
 *                                MLD is on the LOG scale and
 *                                UNBOUNDED above.
 *        - axis-22 Theil-T = GE(1): same family but EQUAL-WEIGHTED;
 *                                MLD's log(mean/x) reciprocates
 *                                the (x/mean) factor in Theil-T.
 *                                Numerically distinct on every
 *                                non-degenerate input.
 *        - axis-23 Atkinson(eps): MLD is the LIMIT of the Atkinson
 *                                index as eps -> 1 in the sense
 *                                that 1 - exp(-MLD) = A(eps=1).
 *                                We ALSO emit `atkinsonEps1` =
 *                                1 - exp(-MLD) per lens to make
 *                                the link computable, but the
 *                                primary statistic is the
 *                                LOGARITHMIC, UNBOUNDED MLD --
 *                                NOT the bounded-in-[0,1] Atkinson
 *                                that axis-23 reports at general eps.
 *        - axis-24 QCD         : two-quartile point statistic.
 *        - axis-25 Hoover      : L_infinity Lorenz gap.
 *        - axis-26 Palma       : top-decile / bottom-40% RATIO.
 *        - axis-27 GE(2)       : same family but TOP-TAIL emphasising;
 *                                MLD is BOTTOM-TAIL emphasising.
 *                                The two together bracket Theil-T.
 *        - axis-28 Bonferroni  : harmonic Lorenz-gap kernel (1/p).
 *        - axis-29 Kolm-Pollak : translation-invariant exponential
 *                                welfare-loss gap.
 *        - axis-30 Mehran      : linear Lorenz-gap kernel (1-p).
 *        - axis-31 S-Gini      : (1-p)^(nu-2) Lorenz-gap kernel.
 *
 *      No prior axis emits the LOG-SCALE arithmetic-vs-geometric
 *      mean ratio. MLD is the unique member of the suite that is
 *      DEFINED ONLY for strictly positive inputs (any x_i = 0
 *      forces MLD = +inf), which we surface as the
 *      `zero-element` degenerate reason.
 *
 *   3. ANALYTIC IDENTITIES the axis can verify on the fly:
 *
 *        a. AM-GM IDENTITY. mean(x) >= geometric_mean(x), with
 *           equality iff all x_i are equal. So MLD >= 0 with
 *           equality iff perfectly equal.
 *
 *        b. ATKINSON LIMIT. A(eps -> 1) = 1 - exp(-MLD). We
 *           report this as the `atkinsonEps1` column for every
 *           lens. axis-23 cannot produce this because axis-23's
 *           CLI surface is parameterised on a FIXED eps that
 *           defaults to 0.5 and our suite never set eps = 1.
 *
 *        c. JENSEN'S-INEQUALITY GAP. MLD equals the Jensen gap of
 *           the concave function log() against the empirical
 *           distribution of x: MLD = log(E[x]) - E[log(x)] >= 0,
 *           which is exactly the Jensen-Shannon-style log-mean
 *           penalty.
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.265. For each lens L:
 *
 *   For each source s in the SHARED set (sources present in ALL
 *   six lens reports):
 *     halfWidth_{L,s} = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *
 *   With n >= 4 and mean m > 0 and ALL x_i > 0:
 *     MLD = log(m) - (1/n) * sum_i log(x_i)
 *         = (1/n) * sum_i log(m / x_i)
 *
 *   Edge cases (parity with axes 21-31):
 *     - n < 4: MLD = 0, degenerateFlag = true,
 *              reason = 'too-few-sources'.
 *     - mean <= 0: MLD = 0, degenerateFlag = true,
 *              reason = 'zero-mean'.
 *     - Any x_i == 0: MLD = 0, degenerateFlag = true,
 *              reason = 'zero-element'  (UNIQUE to MLD; no other
 *              cross-lens axis raises this).
 *     - All half-widths identical: MLD = 0 exactly (NOT degenerate).
 *     - Any half-width is negative or non-finite: throws.
 *
 * Per-lens columns:
 *   - `lens`                    -- canonical lens name
 *   - `nShared`                 -- number of shared sources used
 *   - `meanHalfWidth`           -- arithmetic mean of half-widths
 *   - `geometricMeanHalfWidth`  -- geometric mean of half-widths
 *                                  (NaN on degenerate)
 *   - `minHalfWidth`            -- min half-width across sources
 *   - `maxHalfWidth`            -- max half-width across sources
 *   - `mld`                     -- MLD = log(AM/GM); >= 0; UNBOUNDED above
 *   - `atkinsonEps1`            -- 1 - exp(-MLD); in [0, 1]
 *                                  (a derived bounded transform)
 *   - `bottomKernelWeight`      -- max_i log(mean / x_i) / n  --
 *                                  the largest single-source
 *                                  contribution to MLD; diagnostic
 *                                  for bottom-tail sensitivity
 *                                  concentration
 *   - `concentrationLabel`      -- qualitative bin on MLD:
 *                                  'extreme'           (>= 1.0)
 *                                  'high'              ([0.5, 1.0))
 *                                  'moderate'          ([0.1, 0.5))
 *                                  'mild'              ((0, 0.1))
 *                                  'near-uniform'      (== 0)
 *                                  'degenerate'        (degenerateFlag)
 *   - `degenerateFlag`          -- true iff hit an edge case
 *   - `degenerateReason`        -- reason string, or null
 *
 * Report-level: meanMLD, medianMLD, maxMLD, minMLD, rangeMLD,
 * nDegenerate, nExtreme, nNearUniform, mostExtremeLens (argmax MLD),
 * mostUniformLens (argmin MLD).
 *
 * Filters:
 *   - --alert-mld <f>            -- keep lenses with MLD > f (f >= 0)
 *
 * Sorts: 'mld-desc' (default), 'mld-asc',
 *        'mean-halfwidth-desc', 'lens'.
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_MLD_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthMldLensName =
  (typeof SLOPE_LENS_WIDTH_MLD_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 4;

const EXTREME_THRESHOLD = 1.0;
const HIGH_THRESHOLD = 0.5;
const MODERATE_THRESHOLD = 0.1;

export type MldDegenerateReason =
  | 'too-few-sources'
  | 'zero-mean'
  | 'zero-element';

export type MldConcentrationLabel =
  | 'extreme'
  | 'high'
  | 'moderate'
  | 'mild'
  | 'near-uniform'
  | 'degenerate';

export interface SourceRowTokenSlopeCiLensWidthMldOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertMld?: number | null;
  sort?: 'mld-desc' | 'mld-asc' | 'mean-halfwidth-desc' | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthMldLensRow {
  lens: SlopeLensWidthMldLensName;
  nShared: number;
  meanHalfWidth: number;
  geometricMeanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  mld: number;
  atkinsonEps1: number;
  bottomKernelWeight: number;
  concentrationLabel: MldConcentrationLabel;
  degenerateFlag: boolean;
  degenerateReason: MldDegenerateReason | null;
  perSourceHalfWidths: number[];
  perSourceSources: string[];
}

export interface SourceRowTokenSlopeCiLensWidthMldReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertMld: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiLensWidthMldOptions['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  meanMLD: number;
  medianMLD: number;
  maxMLD: number;
  minMLD: number;
  rangeMLD: number;
  nDegenerate: number;
  nExtreme: number;
  nNearUniform: number;
  mostExtremeLens: SlopeLensWidthMldLensName | null;
  mostUniformLens: SlopeLensWidthMldLensName | null;
  rows: SourceRowTokenSlopeCiLensWidthMldLensRow[];
}

const VALID_SORTS = [
  'mld-desc',
  'mld-asc',
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
  mld: number,
  degenerate: boolean,
): MldConcentrationLabel {
  if (degenerate) return 'degenerate';
  if (!Number.isFinite(mld) || mld <= 0) return 'near-uniform';
  if (mld >= EXTREME_THRESHOLD) return 'extreme';
  if (mld >= HIGH_THRESHOLD) return 'high';
  if (mld >= MODERATE_THRESHOLD) return 'moderate';
  return 'mild';
}

/**
 * Compute the MEAN LOG DEVIATION on a single set of non-negative
 * half-widths.
 *
 *   MLD = log(arithmetic_mean) - (1/n) * sum_i log(x_i)
 *       = log(arithmetic_mean / geometric_mean)
 *
 * Unbounded above; >= 0; equal to 0 iff all x_i are identical.
 * Returns degenerate metadata for the standard edge cases plus
 * the MLD-unique `zero-element` case.
 *
 * Exposed for direct unit-testing.
 */
export function lensWidthMld(halfWidths: number[]): {
  nShared: number;
  meanHalfWidth: number;
  geometricMeanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  mld: number;
  atkinsonEps1: number;
  bottomKernelWeight: number;
  degenerateFlag: boolean;
  degenerateReason: MldDegenerateReason | null;
} {
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthMld: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthMld: halfWidths must be non-negative (got ${v})`,
      );
    }
  }
  const n = halfWidths.length;
  if (n < MIN_SHARED_SOURCES) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      geometricMeanHalfWidth: NaN,
      minHalfWidth: 0,
      maxHalfWidth: 0,
      mld: 0,
      atkinsonEps1: 0,
      bottomKernelWeight: 0,
      degenerateFlag: true,
      degenerateReason: 'too-few-sources',
    };
  }
  let total = 0;
  let minV = Infinity;
  let maxV = -Infinity;
  let hasZero = false;
  for (const v of halfWidths) {
    total += v;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
    if (v === 0) hasZero = true;
  }
  const mean = total / n;
  if (!(mean > 0) || !Number.isFinite(mean)) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      geometricMeanHalfWidth: NaN,
      minHalfWidth: minV,
      maxHalfWidth: maxV,
      mld: 0,
      atkinsonEps1: 0,
      bottomKernelWeight: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-mean',
    };
  }
  if (hasZero) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      geometricMeanHalfWidth: 0,
      minHalfWidth: minV,
      maxHalfWidth: maxV,
      mld: 0,
      atkinsonEps1: 0,
      bottomKernelWeight: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-element',
    };
  }

  // All x_i strictly positive. Compute mean(log x) directly.
  let sumLog = 0;
  let maxContrib = 0;
  const logMean = Math.log(mean);
  for (const v of halfWidths) {
    sumLog += Math.log(v);
    const contrib = (logMean - Math.log(v)) / n;
    if (contrib > maxContrib) maxContrib = contrib;
  }
  const meanLog = sumLog / n;
  let mld = logMean - meanLog;
  // Numerical floor: MLD is theoretically >= 0. Clip tiny FP drift.
  if (mld < 0 && mld > -1e-12) mld = 0;
  if (mld < 0) {
    // Should be impossible by AM-GM but defend against pathological FP.
    mld = 0;
  }
  const geometricMean = Math.exp(meanLog);
  const atkinsonEps1 = 1 - Math.exp(-mld);

  return {
    nShared: n,
    meanHalfWidth: mean,
    geometricMeanHalfWidth: geometricMean,
    minHalfWidth: minV,
    maxHalfWidth: maxV,
    mld,
    atkinsonEps1,
    bottomKernelWeight: maxContrib,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

/**
 * Derived diagnostic: MLD <-> THEIL-T pair. Reports both the
 * GE(0) and GE(1) members of the same family on the same widths.
 *
 *   Theil-T = GE(1) = (1/n) * sum_i (x_i/mean) * log(x_i/mean)
 *
 * Returns null on degenerate input.
 */
export function lensWidthMldTheilPair(
  halfWidths: number[],
): { mld: number; theilT: number; ratio: number } | null {
  const m = lensWidthMld(halfWidths);
  if (m.degenerateFlag) return null;
  const n = halfWidths.length;
  const mean = m.meanHalfWidth;
  let acc = 0;
  for (const v of halfWidths) {
    const r = v / mean;
    acc += r * Math.log(r);
  }
  const theilT = acc / n;
  // Theil-T is theoretically >= 0; clip tiny FP drift.
  const tFloor = theilT < 0 && theilT > -1e-12 ? 0 : theilT;
  const ratio =
    tFloor > 0
      ? m.mld / tFloor
      : m.mld === 0
        ? 1
        : Infinity;
  return { mld: m.mld, theilT: tFloor, ratio };
}

export function buildSourceRowTokenSlopeCiLensWidthMld(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthMldOptions = {},
): SourceRowTokenSlopeCiLensWidthMldReport {
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
  const alertMld = opts.alertMld ?? null;
  if (alertMld !== null) {
    if (!Number.isFinite(alertMld) || alertMld < 0) {
      throw new Error(
        `alertMld must be a finite number >= 0 (got ${opts.alertMld})`,
      );
    }
  }
  const sort = opts.sort ?? 'mld-desc';
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
    SlopeLensWidthMldLensName,
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
  for (const lens of SLOPE_LENS_WIDTH_MLD_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_MLD_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthMldLensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_MLD_LENS_NAMES) {
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const halfW = (hi - lo) / 2;
      halfs.push(halfW);
    }
    const comp = lensWidthMld(halfs);
    rows.push({
      lens,
      nShared: comp.nShared,
      meanHalfWidth: comp.meanHalfWidth,
      geometricMeanHalfWidth: comp.geometricMeanHalfWidth,
      minHalfWidth: comp.minHalfWidth,
      maxHalfWidth: comp.maxHalfWidth,
      mld: comp.mld,
      atkinsonEps1: comp.atkinsonEps1,
      bottomKernelWeight: comp.bottomKernelWeight,
      concentrationLabel: classifyConcentration(comp.mld, comp.degenerateFlag),
      degenerateFlag: comp.degenerateFlag,
      degenerateReason: comp.degenerateReason,
      perSourceHalfWidths: halfs,
      perSourceSources: [...sharedSources],
    });
  }

  const finite = rows.filter((r) => !r.degenerateFlag);
  const ms = finite.map((r) => r.mld);
  const meanMLD = ms.length > 0 ? ms.reduce((a, b) => a + b, 0) / ms.length : 0;
  const medianMLD = median(ms);
  const maxMLD = ms.length > 0 ? Math.max(...ms) : 0;
  const minMLD = ms.length > 0 ? Math.min(...ms) : 0;
  const rangeMLD = ms.length > 0 ? maxMLD - minMLD : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nExtreme = rows.filter(
    (r) => r.concentrationLabel === 'extreme',
  ).length;
  const nNearUniform = rows.filter(
    (r) => r.concentrationLabel === 'near-uniform',
  ).length;

  let mostExtremeLens: SlopeLensWidthMldLensName | null = null;
  let mostUniformLens: SlopeLensWidthMldLensName | null = null;
  if (finite.length > 0) {
    let bestHi = -Infinity;
    let bestLo = Infinity;
    for (const r of finite) {
      if (r.mld > bestHi) {
        bestHi = r.mld;
        mostExtremeLens = r.lens;
      }
      if (r.mld < bestLo) {
        bestLo = r.mld;
        mostUniformLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertMld !== null) {
    filtered = filtered.filter((r) => r.mld > alertMld);
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthMldLensRow,
      b: SourceRowTokenSlopeCiLensWidthMldLensRow,
    ) => number
  > = {
    'mld-desc': (a, b) => b.mld - a.mld,
    'mld-asc': (a, b) => a.mld - b.mld,
    'mean-halfwidth-desc': (a, b) => b.meanHalfWidth - a.meanHalfWidth,
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_MLD_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_MLD_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_MLD_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_MLD_LENS_NAMES.indexOf(b.lens)
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
    alertMld,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    meanMLD,
    medianMLD,
    maxMLD,
    minMLD,
    rangeMLD,
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

export function renderSourceRowTokenSlopeCiLensWidthMld(
  r: SourceRowTokenSlopeCiLensWidthMldReport,
  opts: {
    showSummary?: boolean;
    showConcentrationAggregate?: boolean;
    showLensAttribution?: boolean;
    showTheilPair?: boolean;
    showPerSourceWidths?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showConcentrationAggregate = opts.showConcentrationAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showTheilPair = opts.showTheilPair ?? false;
  const showPerSourceWidths = opts.showPerSourceWidths ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-width-mld');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-mld: ${r.alertMld ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanMLD: ${fmtNum(r.meanMLD, 6)}; medianMLD: ${fmtNum(r.medianMLD, 6)}; maxMLD: ${fmtNum(r.maxMLD, 6)}; minMLD: ${fmtNum(r.minMLD, 6)}; rangeMLD: ${fmtNum(r.rangeMLD, 6)}; nExtreme: ${r.nExtreme}; nNearUniform: ${r.nNearUniform}; nDegen: ${r.nDegenerate}; mostExtreme: ${r.mostExtremeLens ?? '-'}; mostUniform: ${r.mostUniformLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     MLD        mean       gmean      min        max        atkE1      bottomW    concentration       reason',
  );
  lines.push(
    '-----------------  ----  ---------  ---------  ---------  ---------  ---------  ---------  ---------  ------------------  ---------------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        fmtNum(row.mld, 6).padStart(9),
        fmtNum(row.meanHalfWidth, 6).padStart(9),
        fmtNum(row.geometricMeanHalfWidth, 6).padStart(9),
        fmtNum(row.minHalfWidth, 6).padStart(9),
        fmtNum(row.maxHalfWidth, 6).padStart(9),
        fmtNum(row.atkinsonEps1, 6).padStart(9),
        fmtNum(row.bottomKernelWeight, 6).padStart(9),
        row.concentrationLabel.padEnd(18),
        (row.degenerateReason ?? '-').padEnd(21),
      ].join('  '),
    );
    if (showSummary) {
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} MLD=${fmtNum(row.mld, 6)} AM=${fmtNum(row.meanHalfWidth, 6)} GM=${fmtNum(row.geometricMeanHalfWidth, 6)} A(eps=1)=${fmtNum(row.atkinsonEps1, 6)} concentration=${row.concentrationLabel}`,
      );
    }
    if (showTheilPair) {
      if (row.degenerateFlag) {
        lines.push(`    theilPair: (degenerate)`);
      } else {
        const pair = lensWidthMldTheilPair(row.perSourceHalfWidths);
        if (pair === null) {
          lines.push(`    theilPair: (degenerate)`);
        } else {
          lines.push(
            `    theilPair: MLD=${fmtNum(pair.mld, 6)} TheilT=${fmtNum(pair.theilT, 6)} ratio=MLD/T=${fmtNum(pair.ratio, 4)} (MLD=GE(0) bottom-emphasising; TheilT=GE(1) equal-weighted)`,
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
      `[concentration aggregate] nExtreme=${r.nExtreme}/${denom} (${fmtNum(r.nExtreme / denom, 4)}) nNearUniform=${r.nNearUniform}/${denom} (${fmtNum(r.nNearUniform / denom, 4)}) nDegen=${r.nDegenerate}/${denom} (${fmtNum(r.nDegenerate / denom, 4)}) meanMLD=${fmtNum(r.meanMLD, 6)} medianMLD=${fmtNum(r.medianMLD, 6)} rangeMLD=${fmtNum(r.rangeMLD, 6)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostExtreme=${r.mostExtremeLens ?? '-'} (max MLD) mostUniform=${r.mostUniformLens ?? '-'} (min MLD)`,
    );
  }
  return lines.join('\n');
}
