/**
 * source-row-token-slope-ci-lens-width-hoover
 *
 * Per-lens CROSS-SOURCE HOOVER (a.k.a. PIETRA / ROBIN HOOD / SCHUTZ)
 * INDEX of CI half-widths (TWENTY-FIFTH cross-lens axis) for the
 * v0.6.219 Deming-slope uncertainty-quantification suite. Consumes
 * the SAME six per-source slope CIs as v0.6.227-v0.6.252 (percentile
 * bootstrap, jackknife normal, BCa, studentized-t, ABC,
 * profile-likelihood).
 *
 * Mechanically distinct from ALL TWENTY-FOUR prior cross-lens
 * diagnostics on FIVE orthogonal dimensions:
 *
 *   1. POPULATION GEOMETRY (vs axes 1-19). Like axes 20-24, the
 *      report is INDEXED BY LENS (six rows). Axes 1-19 reduce a
 *      6-vector per source to a per-source scalar; this axis
 *      reduces the across-source half-width cloud at each fixed
 *      lens to a single scalar.
 *
 *   2. STATISTIC FAMILY (vs all 1-24). Hoover is the MAXIMUM
 *      VERTICAL DISTANCE between the Lorenz curve and the line of
 *      perfect equality:
 *
 *        H = (1/2) * sum_i | x_i / sum(x) - 1/n |
 *          = sup_p | L(p) - p |
 *
 *      Pietra (1915); Schutz (1951); Hoover (1936). It is a
 *      Kolmogorov-Smirnov-style L_infinity functional of the
 *      Lorenz process, NOT an integral functional. In direct
 *      contrast:
 *        - axis-21 Gini integrates the SAME Lorenz gap over p
 *          (Gini = 2 * integral of (p - L(p)) dp). Hoover takes
 *          the SUPREMUM of the same integrand. Two distributions
 *          can share Hoover but differ in Gini, and vice-versa
 *          (the L1 vs L_infinity norms of (p - L(p)) are
 *          inequivalent on the simplex).
 *        - axis-22 Theil GE(1) integrates plog(p), an entropic
 *          functional with unbounded sensitivity to upper-tail
 *          mass.
 *        - axis-23 Atkinson is a power-mean welfare loss
 *          (1 - M_(1-eps) / mean), a CRRA-utility integral.
 *        - axis-24 QCD uses EXACTLY TWO order statistics (Q1, Q3);
 *          Hoover uses the FULL n-vector via an absolute-deviation
 *          sum.
 *      Hoover therefore has a DIFFERENT NORM (L_infinity on the
 *      Lorenz process), DIFFERENT GEOMETRY (max gap, not area),
 *      and a DIRECT ECONOMIC INTERPRETATION that no prior axis
 *      shares: the FRACTION OF TOTAL HALF-WIDTH MASS that would
 *      have to be REDISTRIBUTED across sources to achieve perfect
 *      equality (the "Robin Hood" interpretation).
 *
 *   3. SENSITIVITY PROFILE (vs axes 21, 22, 23). The Hoover
 *      transfer principle is WEAKER than the Pigou-Dalton transfer
 *      principle that Gini, Theil, and Atkinson all satisfy:
 *      Hoover is INSENSITIVE to mean-preserving transfers ON THE
 *      SAME SIDE of the mean (transfers entirely above or
 *      entirely below the mean leave H unchanged). This makes
 *      Hoover the canonical diagnostic for "what fraction of mass
 *      crosses the mean line", which Gini/Theil/Atkinson smear
 *      across the whole distribution.
 *
 *   4. BOUNDEDNESS AND ZERO-IMMUNITY (vs axes 22, 23). Bounded
 *      in [0, 1 - 1/n] for any non-negative n-vector with positive
 *      sum. Tolerates up to n - 1 zero half-widths without
 *      degeneracy (only the all-zero case is degenerate). Theil
 *      GE(1) requires every source > 0; Atkinson at eps>=1
 *      collapses to A=1 on a single zero. Hoover therefore has the
 *      WIDEST domain of any cross-lens inequality measure shipped.
 *
 *   5. COMPUTATIONAL FORM (vs all 1-24). H is a SINGLE-PASS sum of
 *      absolute deviations from the mean share -- O(n) and
 *      derivative-free. No quantile, no log, no power, no Lorenz
 *      cumulation, no Pearson moment.
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.252. For each lens L:
 *
 *   For each source s in S (sources present in ALL six lens
 *   reports):
 *     halfWidth_{L,s} = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *
 *   Let w_i be the n cross-source half-widths. With S = sum(w_i)
 *   and n >= 1:
 *
 *     H = (1/2) * sum_i | w_i / S - 1/n |
 *
 *   Equivalently the maximum vertical gap between the Lorenz
 *   curve and the diagonal.
 *
 *   Edge cases:
 *     - n < 4 (parity with axes 21-24): H = 0, degenerateFlag =
 *       true, reason = 'too-few-sources'.
 *     - S = 0 (every half-width is exactly zero): H = 0,
 *       degenerateFlag = true, reason = 'zero-mass'.
 *     - Any half-width is negative or non-finite: throws.
 *
 *   Numerical safety: the result is clamped into [0, 1]. (The
 *   tighter [0, 1 - 1/n] bound is reported as `hooverMax` for
 *   each row and the normalised ratio H / (1 - 1/n) is exposed
 *   as `hooverNormalised`, the "fraction of attainable
 *   redistribution" in [0, 1].)
 *
 * Per-lens columns:
 *   - `lens`              -- canonical lens name
 *   - `nShared`           -- number of shared sources used
 *   - `meanHalfWidth`     -- arithmetic mean of half-widths
 *   - `totalHalfWidth`    -- sum of half-widths (the redistributable mass)
 *   - `hoover`            -- Hoover index in [0, 1 - 1/n]
 *   - `hooverNormalised`  -- H / (1 - 1/n) in [0, 1]
 *   - `redistributableShare` -- alias for `hoover`; emphasised in render
 *   - `argmaxLorenzGapP`  -- the quantile p* in (0, 1] at which the
 *                            Lorenz gap p - L(p) attains its supremum
 *                            H (Hoover-Pietra characterisation; in a
 *                            sorted population this is the cumulative
 *                            share of "small-mass" sources just above
 *                            the mean-share crossover). Returns 0 if
 *                            degenerate or H = 0.
 *   - `meanCrossoverIndex` -- 1-based count of sources whose share is
 *                             strictly BELOW the mean share 1/n. The
 *                             argmax-of-the-Lorenz-gap is canonically
 *                             attained at this crossover (Pietra 1915).
 *                             0 if degenerate.
 *   - `concentrationLabel` -- qualitative bin on `hoover`:
 *                            'highly-concentrated' (H > 0.5)
 *                            'moderately-concentrated' (H in (0.3, 0.5])
 *                            'mild-concentration'  (H in (0.1, 0.3])
 *                            'near-uniform'        (H in [0,   0.1])
 *                            'degenerate'          (degenerateFlag)
 *   - `degenerateFlag`    -- true iff hit an edge case
 *   - `degenerateReason`  -- reason string, or null
 *
 * Report-level:
 *   - meanHoover          -- mean of non-degenerate Hoover values
 *   - medianHoover        -- median of non-degenerate Hoover values
 *   - maxHoover, minHoover, rangeHoover
 *   - nDegenerate         -- # lenses with degenerateFlag
 *   - nHighlyConcentrated -- # lenses with H > 0.5
 *   - nNearUniform        -- # lenses with H <= 0.1
 *   - mostConcentratedLens -- argmax_L H (canonical tie-break)
 *   - mostUniformLens      -- argmin_L H (canonical tie-break)
 *
 * Filters:
 *   - --alert-hoover <f>  -- keep lenses with H > f (f in [0, 1])
 *   - --alert-mass <f>    -- keep lenses with totalHalfWidth > f
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthHooverLensName =
  (typeof SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 4;
const HIGH_THRESHOLD = 0.5;
const MODERATE_THRESHOLD = 0.3;
const NEAR_UNIFORM_THRESHOLD = 0.1;

export type HooverDegenerateReason =
  | 'too-few-sources'
  | 'zero-mass'
  | 'non-finite';

export type HooverConcentrationLabel =
  | 'highly-concentrated'
  | 'moderately-concentrated'
  | 'mild-concentration'
  | 'near-uniform'
  | 'degenerate';

export interface SourceRowTokenSlopeCiLensWidthHooverOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertHoover?: number | null;
  alertMass?: number | null;
  alertCrossoverShare?: number | null;
  sort?:
    | 'hoover-desc'
    | 'hoover-asc'
    | 'mass-desc'
    | 'mean-halfwidth-desc'
    | 'crossover-share-desc'
    | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthHooverLensRow {
  lens: SlopeLensWidthHooverLensName;
  nShared: number;
  meanHalfWidth: number;
  totalHalfWidth: number;
  hoover: number;
  hooverNormalised: number;
  hooverMax: number;
  redistributableShare: number;
  argmaxLorenzGapP: number;
  meanCrossoverIndex: number;
  meanCrossoverShare: number;
  concentrationLabel: HooverConcentrationLabel;
  degenerateFlag: boolean;
  degenerateReason: HooverDegenerateReason | null;
  perSourceHalfWidths: number[];
  perSourceSources: string[];
}

export interface SourceRowTokenSlopeCiLensWidthHooverReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertHoover: number | null;
  alertMass: number | null;
  alertCrossoverShare: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiLensWidthHooverOptions['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  meanHoover: number;
  medianHoover: number;
  maxHoover: number;
  minHoover: number;
  rangeHoover: number;
  nDegenerate: number;
  nHighlyConcentrated: number;
  nNearUniform: number;
  mostConcentratedLens: SlopeLensWidthHooverLensName | null;
  mostUniformLens: SlopeLensWidthHooverLensName | null;
  rows: SourceRowTokenSlopeCiLensWidthHooverLensRow[];
}

const VALID_SORTS = [
  'hoover-desc',
  'hoover-asc',
  'mass-desc',
  'mean-halfwidth-desc',
  'crossover-share-desc',
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
  hoover: number,
  degenerate: boolean,
): HooverConcentrationLabel {
  if (degenerate) return 'degenerate';
  if (hoover > HIGH_THRESHOLD) return 'highly-concentrated';
  if (hoover > MODERATE_THRESHOLD) return 'moderately-concentrated';
  if (hoover > NEAR_UNIFORM_THRESHOLD) return 'mild-concentration';
  return 'near-uniform';
}

/**
 * Compute the HOOVER (Pietra / Schutz / Robin Hood) index on a
 * single set of non-negative half-widths:
 *
 *     H = (1/2) * sum_i | w_i / S - 1/n |
 *
 * with S = sum(w_i). Bounded in [0, 1 - 1/n].
 *
 * Returns degenerate metadata for the standard edge cases.
 *
 * Exposed for direct unit-testing.
 */
export function lensWidthHoover(halfWidths: number[]): {
  nShared: number;
  meanHalfWidth: number;
  totalHalfWidth: number;
  hoover: number;
  hooverMax: number;
  hooverNormalised: number;
  degenerateFlag: boolean;
  degenerateReason: HooverDegenerateReason | null;
} {
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthHoover: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthHoover: halfWidths must be non-negative (got ${v})`,
      );
    }
  }
  const n = halfWidths.length;
  if (n < MIN_SHARED_SOURCES) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      totalHalfWidth: 0,
      hoover: 0,
      hooverMax: 0,
      hooverNormalised: 0,
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
      hoover: 0,
      hooverMax: 1 - 1 / n,
      hooverNormalised: 0,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  if (total === 0) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      totalHalfWidth: 0,
      hoover: 0,
      hooverMax: 1 - 1 / n,
      hooverNormalised: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-mass',
    };
  }
  const mean = total / n;
  const eqShare = 1 / n;
  let absSum = 0;
  for (const v of halfWidths) {
    absSum += Math.abs(v / total - eqShare);
  }
  let hoover = 0.5 * absSum;
  if (!Number.isFinite(hoover)) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      totalHalfWidth: total,
      hoover: 0,
      hooverMax: 1 - 1 / n,
      hooverNormalised: 0,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  if (hoover < 0) hoover = 0;
  if (hoover > 1) hoover = 1;
  const hooverMax = 1 - 1 / n;
  const hooverNormalised = hooverMax > 0 ? hoover / hooverMax : 0;
  return {
    nShared: n,
    meanHalfWidth: mean,
    totalHalfWidth: total,
    hoover,
    hooverMax,
    hooverNormalised:
      hooverNormalised > 1
        ? 1
        : hooverNormalised < 0
          ? 0
          : hooverNormalised,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

/**
 * Compute the Lorenz-gap argmax for a non-negative half-width vector.
 *
 * Returns:
 *   - `argmaxP`: the quantile p* in (0, 1] at which the Lorenz gap
 *                p - L(p) attains its supremum (the same supremum that
 *                Hoover H equals). Sorted ascending; p* is canonically
 *                the rank just before the mean-share crossover
 *                (Pietra 1915 -- the supremum is attained at the
 *                largest k for which sorted[k] < mean).
 *   - `crossoverIndex`: 1-based count of sources whose share is
 *                       strictly below 1/n (i.e. value < mean).
 *   - `crossoverShare`: crossoverIndex / n in [0, 1).
 *
 * Returns zeros for degenerate / all-equal inputs (no gap).
 *
 * Exposed for direct unit-testing.
 */
export function lorenzGapArgmax(halfWidths: number[]): {
  argmaxP: number;
  crossoverIndex: number;
  crossoverShare: number;
} {
  const n = halfWidths.length;
  if (n === 0) return { argmaxP: 0, crossoverIndex: 0, crossoverShare: 0 };
  let total = 0;
  for (const v of halfWidths) total += v;
  if (!(total > 0)) {
    return { argmaxP: 0, crossoverIndex: 0, crossoverShare: 0 };
  }
  const mean = total / n;
  const sorted = [...halfWidths].sort((a, b) => a - b);
  let crossover = 0;
  for (const v of sorted) {
    if (v < mean) crossover += 1;
    else break;
  }
  return {
    argmaxP: crossover / n,
    crossoverIndex: crossover,
    crossoverShare: crossover / n,
  };
}

export function buildSourceRowTokenSlopeCiLensWidthHoover(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthHooverOptions = {},
): SourceRowTokenSlopeCiLensWidthHooverReport {
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
  const alertHoover = opts.alertHoover ?? null;
  if (alertHoover !== null) {
    if (
      !Number.isFinite(alertHoover) ||
      alertHoover < 0 ||
      alertHoover > 1
    ) {
      throw new Error(
        `alertHoover must be a finite number in [0, 1] (got ${opts.alertHoover})`,
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
  const alertCrossoverShare = opts.alertCrossoverShare ?? null;
  if (alertCrossoverShare !== null) {
    if (
      !Number.isFinite(alertCrossoverShare) ||
      alertCrossoverShare < 0 ||
      alertCrossoverShare >= 1
    ) {
      throw new Error(
        `alertCrossoverShare must be a finite number in [0, 1) (got ${opts.alertCrossoverShare})`,
      );
    }
  }
  const sort = opts.sort ?? 'hoover-desc';
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
    SlopeLensWidthHooverLensName,
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
  for (const lens of SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthHooverLensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES) {
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const halfW = (hi - lo) / 2;
      halfs.push(halfW);
    }
    const comp = lensWidthHoover(halfs);
    const concentrationLabel = classifyConcentration(
      comp.hoover,
      comp.degenerateFlag,
    );
    const gap = comp.degenerateFlag
      ? { argmaxP: 0, crossoverIndex: 0, crossoverShare: 0 }
      : lorenzGapArgmax(halfs);
    rows.push({
      lens,
      nShared: comp.nShared,
      meanHalfWidth: comp.meanHalfWidth,
      totalHalfWidth: comp.totalHalfWidth,
      hoover: comp.hoover,
      hooverNormalised: comp.hooverNormalised,
      hooverMax: comp.hooverMax,
      redistributableShare: comp.hoover,
      argmaxLorenzGapP: gap.argmaxP,
      meanCrossoverIndex: gap.crossoverIndex,
      meanCrossoverShare: gap.crossoverShare,
      concentrationLabel,
      degenerateFlag: comp.degenerateFlag,
      degenerateReason: comp.degenerateReason,
      perSourceHalfWidths: halfs,
      perSourceSources: [...sharedSources],
    });
  }

  const nonDegen = rows.filter((r) => !r.degenerateFlag);
  const hs = nonDegen.map((r) => r.hoover);
  const meanHoover =
    hs.length > 0 ? hs.reduce((a, b) => a + b, 0) / hs.length : 0;
  const medianHoover = median(hs);
  const maxHoover = hs.length > 0 ? Math.max(...hs) : 0;
  const minHoover = hs.length > 0 ? Math.min(...hs) : 0;
  const rangeHoover = hs.length > 0 ? maxHoover - minHoover : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nHighlyConcentrated = rows.filter(
    (r) => r.concentrationLabel === 'highly-concentrated',
  ).length;
  const nNearUniform = rows.filter(
    (r) => r.concentrationLabel === 'near-uniform',
  ).length;

  let mostConcentratedLens: SlopeLensWidthHooverLensName | null = null;
  let mostUniformLens: SlopeLensWidthHooverLensName | null = null;
  if (nonDegen.length > 0) {
    let bestHi = -Infinity;
    let bestLo = Infinity;
    for (const r of nonDegen) {
      if (r.hoover > bestHi) {
        bestHi = r.hoover;
        mostConcentratedLens = r.lens;
      }
      if (r.hoover < bestLo) {
        bestLo = r.hoover;
        mostUniformLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertHoover !== null) {
    filtered = filtered.filter((r) => r.hoover > alertHoover);
  }
  if (alertMass !== null) {
    filtered = filtered.filter((r) => r.totalHalfWidth > alertMass);
  }
  if (alertCrossoverShare !== null) {
    filtered = filtered.filter(
      (r) => !r.degenerateFlag && r.meanCrossoverShare > alertCrossoverShare,
    );
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthHooverLensRow,
      b: SourceRowTokenSlopeCiLensWidthHooverLensRow,
    ) => number
  > = {
    'hoover-desc': (a, b) => b.hoover - a.hoover,
    'hoover-asc': (a, b) => a.hoover - b.hoover,
    'mass-desc': (a, b) => b.totalHalfWidth - a.totalHalfWidth,
    'mean-halfwidth-desc': (a, b) => b.meanHalfWidth - a.meanHalfWidth,
    'crossover-share-desc': (a, b) => {
      // Degenerate rows demoted to bottom of desc.
      const sa = a.degenerateFlag ? -Infinity : a.meanCrossoverShare;
      const sb = b.degenerateFlag ? -Infinity : b.meanCrossoverShare;
      return sb - sa;
    },
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES.indexOf(b.lens)
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
    alertHoover,
    alertMass,
    alertCrossoverShare,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    meanHoover,
    medianHoover,
    maxHoover,
    minHoover,
    rangeHoover,
    nDegenerate,
    nHighlyConcentrated,
    nNearUniform,
    mostConcentratedLens,
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

export function renderSourceRowTokenSlopeCiLensWidthHoover(
  r: SourceRowTokenSlopeCiLensWidthHooverReport,
  opts: {
    showSummary?: boolean;
    showConcentrationAggregate?: boolean;
    showLensAttribution?: boolean;
    showRedistribution?: boolean;
    showLorenzGap?: boolean;
    showPerSourceWidths?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showConcentrationAggregate = opts.showConcentrationAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showRedistribution = opts.showRedistribution ?? false;
  const showLorenzGap = opts.showLorenzGap ?? false;
  const showPerSourceWidths = opts.showPerSourceWidths ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-width-hoover');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-hoover: ${r.alertHoover ?? '-'}    alert-mass: ${r.alertMass ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanH: ${fmtNum(r.meanHoover)}; medianH: ${fmtNum(r.medianHoover)}; maxH: ${fmtNum(r.maxHoover)}; minH: ${fmtNum(r.minHoover)}; rangeH: ${fmtNum(r.rangeHoover)}; nHighlyConcentrated: ${r.nHighlyConcentrated}; nNearUniform: ${r.nNearUniform}; nDegen: ${r.nDegenerate}; mostConcentrated: ${r.mostConcentratedLens ?? '-'}; mostUniform: ${r.mostUniformLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     H        Hnorm    mean       total      concentration            reason',
  );
  lines.push(
    '-----------------  ----  -------  -------  ---------  ---------  -----------------------  ---------------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        fmtNum(row.hoover).padStart(7),
        fmtNum(row.hooverNormalised).padStart(7),
        fmtNum(row.meanHalfWidth, 6).padStart(9),
        fmtNum(row.totalHalfWidth, 6).padStart(9),
        row.concentrationLabel.padEnd(23),
        (row.degenerateReason ?? '-').padEnd(21),
      ].join('  '),
    );
    if (showSummary) {
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} H=${fmtNum(row.hoover)} Hnorm=${fmtNum(row.hooverNormalised)} concentration=${row.concentrationLabel}`,
      );
    }
    if (showRedistribution) {
      const massPct = (row.redistributableShare * 100).toFixed(2);
      lines.push(
        `    redistribution: ${massPct}% of total half-width mass would have to be redistributed across sources to achieve perfect equality (Robin Hood interpretation; Hmax=${fmtNum(row.hooverMax)})`,
      );
    }
    if (showLorenzGap) {
      if (row.degenerateFlag) {
        lines.push(`    lorenzGap: (degenerate)`);
      } else {
        lines.push(
          `    lorenzGap: argmax p*=${fmtNum(row.argmaxLorenzGapP, 4)} (Lorenz-gap supremum attained at quantile p*); meanCrossoverIndex=${row.meanCrossoverIndex}/${row.nShared} (sources strictly below mean share 1/${row.nShared}=${fmtNum(1 / row.nShared, 4)})`,
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
      `[concentration aggregate] nHighlyConcentrated=${r.nHighlyConcentrated}/${denom} (${fmtNum(r.nHighlyConcentrated / denom, 4)}) nNearUniform=${r.nNearUniform}/${denom} (${fmtNum(r.nNearUniform / denom, 4)}) nDegen=${r.nDegenerate}/${denom} (${fmtNum(r.nDegenerate / denom, 4)}) meanH=${fmtNum(r.meanHoover)} medianH=${fmtNum(r.medianHoover)} rangeH=${fmtNum(r.rangeHoover)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostConcentrated=${r.mostConcentratedLens ?? '-'} (max H) mostUniform=${r.mostUniformLens ?? '-'} (min H)`,
    );
  }
  return lines.join('\n');
}
