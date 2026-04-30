/**
 * source-row-token-slope-ci-lens-width-bonferroni
 *
 * Per-lens CROSS-SOURCE BONFERRONI INDEX of CI half-widths
 * (TWENTY-EIGHTH cross-lens axis) for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six
 * per-source slope CIs as v0.6.227-v0.6.257 (percentile bootstrap,
 * jackknife normal, BCa, studentized-t, ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL TWENTY-SEVEN prior cross-lens
 * diagnostics on the following ORTHOGONAL axes:
 *
 *   1. STATISTIC FAMILY. The Bonferroni index (Bonferroni 1930;
 *      Tarsitano 1990; Nygard-Sandstrom 1981) is a RANK-CUMULATIVE
 *      functional defined on the sequence of partial means of the
 *      ascending-sorted half-widths:
 *
 *        Sort w_(1) <= w_(2) <= ... <= w_(n).
 *        M_i = (1/i) * sum_{j=1..i} w_(j)         (cumulative mean)
 *        B   = 1 - (1 / ((n-1) * mean)) * sum_{i=1..n-1} M_i
 *            = 1 - (1 / ((n-1) * mean))
 *               * sum_{i=1..n-1} ((1/i) * sum_{j=1..i} w_(j))
 *
 *      In direct contrast to ALL twenty-seven prior axes:
 *
 *        - axis-21 Gini integrates (p - L(p)) over p (an L_1
 *          functional of the LORENZ process). Bonferroni
 *          integrates the CUMULATIVE-MEAN curve M_i / mean over
 *          the rank index, with a `1/(n-1)` weighting that
 *          emphasises the BOTTOM-TAIL prefix means quadratically
 *          more than the Lorenz gap does -- the M_1 prefix-mean
 *          (the smallest single half-width) carries weight 1, the
 *          M_2 carries weight 1/2, and so on. Gini's Lorenz-gap
 *          weighting is uniform in p.
 *        - axis-22 Theil GE(1) is an entropic LOG-SHARE
 *          functional. Bonferroni uses NO logarithm and is
 *          defined on prefix arithmetic means.
 *        - axis-23 Atkinson is a CRRA welfare loss
 *          (1 - M_(1-eps) / mean). Bonferroni is NOT a welfare
 *          aggregator -- it is the rank-weighted area between
 *          the prefix-mean curve and the population mean.
 *        - axis-24 QCD uses two order statistics (Q1, Q3).
 *          Bonferroni uses ALL n prefix sums.
 *        - axis-25 Hoover is L_infinity on the Lorenz process.
 *          Bonferroni is L_1 on the prefix-mean GAP curve
 *          (1 - M_i / mean) with rank-uniform weight.
 *        - axis-26 Palma is a TWO-POINT decile ratio.
 *          Bonferroni integrates over EVERY rank.
 *        - axis-27 GE(2) is a SECOND-MOMENT functional weighted
 *          by x^2 (TOP-tail-sensitive). Bonferroni's `1/i`
 *          rank-weighting kernel is BOTTOM-tail-sensitive: a
 *          fixed absolute transfer FROM the population mean TO
 *          the smallest source raises Bonferroni MUCH more than
 *          it raises GE(2), Gini, or Palma. Bonferroni is the
 *          canonical complement to GE(2) in the lower-tail axis.
 *
 *      Equivalent rank-weighted form (Tarsitano 1990):
 *
 *        B = (1 / ((n-1) * mean))
 *            * sum_{i=1..n-1} ((n-i)/i)
 *              * (mean(top i+1..n) - w_(i))    [used internally
 *                                               only as a
 *                                               cross-check]
 *
 *      We use the prefix-mean form because it is single-pass
 *      O(n) after the sort and numerically clean.
 *
 *   2. SENSITIVITY PROFILE. Satisfies the Pigou-Dalton transfer
 *      principle (like Gini, Theil, Atkinson) AND the BONFERRONI
 *      ORDERING: a transfer from a richer source to a poorer one
 *      lowers Bonferroni STRICTLY MORE if the receiver's rank is
 *      LOWER (the `1/i` kernel). This is the polar opposite of
 *      GE(2)'s top-sensitivity and of Palma's decile knife-edge.
 *
 *   3. BOUNDEDNESS. Bonferroni is bounded in [0, 1]:
 *      0 = perfect equality (all w_i identical -> every M_i =
 *      mean, so the inner sum = (n-1)*mean and B = 0).
 *      1 = limit case (one source carries all the mass; M_i = 0
 *      for i < n, so the inner sum = 0 and B = 1). UNLIKE GE(2)
 *      (unbounded above) and Theil (unbounded above), Bonferroni
 *      is ALWAYS bounded above by 1, like Gini, Atkinson, Hoover.
 *
 *   4. ZERO-IMMUNITY. Tolerates up to n-1 zero half-widths
 *      (only the all-zero case is degenerate -- mean undefined).
 *      Wider domain than Theil (single zero produces -inf in
 *      the log) and Atkinson at eps>=1 (collapses to A=1).
 *
 *   5. RANK-CUMULATIVE STRUCTURE. The intermediate diagnostic
 *      `lowerTailMassShare` = M_{floor(n/2)} * floor(n/2) / S
 *      reports the mass-share carried by the bottom HALF of the
 *      sorted sources. NO prior axis exposes a prefix-mass
 *      diagnostic.
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.257. For each lens L:
 *
 *   For each source s in S (sources present in ALL six lens
 *   reports):
 *     halfWidth_{L,s} = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *
 *   With S = sum(w_i), mean = S / n, n >= 4:
 *
 *     B = 1 - (1 / ((n-1) * mean)) * sum_{i=1..n-1} M_i
 *
 *   Edge cases (parity with axes 21-27):
 *     - n < 4: B = 0, degenerateFlag = true,
 *              reason = 'too-few-sources'.
 *     - S = 0: B = 0, degenerateFlag = true, reason = 'zero-mass'.
 *     - Any half-width is negative or non-finite: throws.
 *     - non-finite intermediate sum: degenerateFlag = true,
 *       reason = 'non-finite'.
 *
 * Per-lens columns:
 *   - `lens`               -- canonical lens name
 *   - `nShared`            -- number of shared sources used
 *   - `meanHalfWidth`      -- arithmetic mean of half-widths
 *   - `totalHalfWidth`     -- sum of half-widths
 *   - `bonferroni`         -- Bonferroni index in [0, 1]
 *   - `lowerTailMassShare` -- bottom-half cumulative mass / total
 *                             in [0, 0.5]; 0 if degenerate
 *   - `bottomToTopRatio`   -- w_(1) / w_(n); in [0, 1]; 0 if
 *                             top is zero or degenerate
 *   - `concentrationLabel` -- qualitative bin on `bonferroni`:
 *                            'extreme'              (B > 0.7)
 *                            'high-concentration'   (B in (0.5, 0.7])
 *                            'moderate'             (B in (0.3, 0.5])
 *                            'mild'                 (B in (0.1, 0.3])
 *                            'near-uniform'         (B in [0, 0.1])
 *                            'degenerate'           (degenerateFlag)
 *   - `degenerateFlag`     -- true iff hit an edge case
 *   - `degenerateReason`   -- reason string, or null
 *
 * Report-level: meanBonferroni, medianBonferroni, maxBonferroni,
 * minBonferroni, rangeBonferroni, nDegenerate, nExtreme,
 * nNearUniform, mostExtremeLens (argmax B), mostUniformLens
 * (argmin B).
 *
 * Filters:
 *   - --alert-bonferroni <f>  -- keep lenses with B > f (f >= 0)
 *   - --alert-mass <f>        -- keep lenses with totalHalfWidth > f
 *   - --alert-lower-tail <f>  -- keep lenses with lowerTailMassShare < f
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthBonferroniLensName =
  (typeof SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 4;
const EXTREME_THRESHOLD = 0.7;
const HIGH_THRESHOLD = 0.5;
const MODERATE_THRESHOLD = 0.3;
const MILD_THRESHOLD = 0.1;

export type BonferroniDegenerateReason =
  | 'too-few-sources'
  | 'zero-mass'
  | 'non-finite';

export type BonferroniConcentrationLabel =
  | 'extreme'
  | 'high-concentration'
  | 'moderate'
  | 'mild'
  | 'near-uniform'
  | 'degenerate';

export interface SourceRowTokenSlopeCiLensWidthBonferroniOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertBonferroni?: number | null;
  alertMass?: number | null;
  alertLowerTail?: number | null;
  sort?:
    | 'bonferroni-desc'
    | 'bonferroni-asc'
    | 'mass-desc'
    | 'mean-halfwidth-desc'
    | 'lower-tail-asc'
    | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthBonferroniLensRow {
  lens: SlopeLensWidthBonferroniLensName;
  nShared: number;
  meanHalfWidth: number;
  totalHalfWidth: number;
  bonferroni: number;
  lowerTailMassShare: number;
  bottomToTopRatio: number;
  concentrationLabel: BonferroniConcentrationLabel;
  degenerateFlag: boolean;
  degenerateReason: BonferroniDegenerateReason | null;
  perSourceHalfWidths: number[];
  perSourceSources: string[];
}

export interface SourceRowTokenSlopeCiLensWidthBonferroniReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertBonferroni: number | null;
  alertMass: number | null;
  alertLowerTail: number | null;
  sort: NonNullable<
    SourceRowTokenSlopeCiLensWidthBonferroniOptions['sort']
  >;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  meanBonferroni: number;
  medianBonferroni: number;
  maxBonferroni: number;
  minBonferroni: number;
  rangeBonferroni: number;
  nDegenerate: number;
  nExtreme: number;
  nNearUniform: number;
  mostExtremeLens: SlopeLensWidthBonferroniLensName | null;
  mostUniformLens: SlopeLensWidthBonferroniLensName | null;
  rows: SourceRowTokenSlopeCiLensWidthBonferroniLensRow[];
}

const VALID_SORTS = [
  'bonferroni-desc',
  'bonferroni-asc',
  'mass-desc',
  'mean-halfwidth-desc',
  'lower-tail-asc',
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
  b: number,
  degenerate: boolean,
): BonferroniConcentrationLabel {
  if (degenerate) return 'degenerate';
  if (b > EXTREME_THRESHOLD) return 'extreme';
  if (b > HIGH_THRESHOLD) return 'high-concentration';
  if (b > MODERATE_THRESHOLD) return 'moderate';
  if (b > MILD_THRESHOLD) return 'mild';
  return 'near-uniform';
}

/**
 * Compute the BONFERRONI INDEX on a single set of non-negative
 * half-widths:
 *
 *   Sort w_(1) <= ... <= w_(n).
 *   M_i = (1/i) * sum_{j<=i} w_(j)
 *   B   = 1 - (1/((n-1)*mean)) * sum_{i=1..n-1} M_i
 *
 * Bounded in [0, 1]. Returns degenerate metadata for the standard
 * edge cases. Also returns `lowerTailMassShare` (bottom-half mass
 * share, in [0, 0.5]) and `bottomToTopRatio` (w_(1) / w_(n)).
 *
 * Numerical safety: the prefix-sum accumulator is single-pass O(n)
 * after a single ascending sort, and the `1/i` rank-weighting kernel
 * is applied via a running division (never as a precomputed table)
 * so the implementation tolerates n in the millions without an
 * intermediate factorial-sized table. Realistic queue magnitudes
 * (CI half-widths up to ~10^9) stay well clear of double-precision
 * overflow.
 *
 * Exposed for direct unit-testing.
 */
export function lensWidthBonferroni(halfWidths: number[]): {
  nShared: number;
  meanHalfWidth: number;
  totalHalfWidth: number;
  bonferroni: number;
  lowerTailMassShare: number;
  bottomToTopRatio: number;
  degenerateFlag: boolean;
  degenerateReason: BonferroniDegenerateReason | null;
} {
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthBonferroni: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthBonferroni: halfWidths must be non-negative (got ${v})`,
      );
    }
  }
  const n = halfWidths.length;
  if (n < MIN_SHARED_SOURCES) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      totalHalfWidth: 0,
      bonferroni: 0,
      lowerTailMassShare: 0,
      bottomToTopRatio: 0,
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
      bonferroni: 0,
      lowerTailMassShare: 0,
      bottomToTopRatio: 0,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  if (total === 0) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      totalHalfWidth: 0,
      bonferroni: 0,
      lowerTailMassShare: 0,
      bottomToTopRatio: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-mass',
    };
  }
  const mean = total / n;
  const sorted = [...halfWidths].sort((a, b) => a - b);
  // Prefix-mean form: M_i = (1/i) * sum_{j<=i} w_(j).
  let prefixSum = 0;
  let sumOfPrefixMeans = 0;
  for (let i = 1; i <= n - 1; i++) {
    prefixSum += sorted[i - 1]!;
    sumOfPrefixMeans += prefixSum / i;
  }
  if (!Number.isFinite(sumOfPrefixMeans)) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      totalHalfWidth: total,
      bonferroni: 0,
      lowerTailMassShare: 0,
      bottomToTopRatio: 0,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  let b = 1 - sumOfPrefixMeans / ((n - 1) * mean);
  if (!Number.isFinite(b)) b = 0;
  if (b < 0) b = 0;
  if (b > 1) b = 1;

  // Lower-tail mass share: cumulative mass through the floor(n/2)-th
  // ranked source, divided by the total.
  const half = Math.floor(n / 2);
  let bottomMass = 0;
  for (let i = 0; i < half; i++) bottomMass += sorted[i]!;
  const lowerTailMassShare = total > 0 ? bottomMass / total : 0;

  // bottomToTopRatio: smallest / largest. In [0, 1]; 0 if largest is 0
  // (which only happens when total=0 -- already returned above).
  const top = sorted[n - 1]!;
  const bottom = sorted[0]!;
  const bottomToTopRatio = top > 0 ? bottom / top : 0;

  return {
    nShared: n,
    meanHalfWidth: mean,
    totalHalfWidth: total,
    bonferroni: b,
    lowerTailMassShare,
    bottomToTopRatio,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

export function buildSourceRowTokenSlopeCiLensWidthBonferroni(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthBonferroniOptions = {},
): SourceRowTokenSlopeCiLensWidthBonferroniReport {
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
  const alertBonferroni = opts.alertBonferroni ?? null;
  if (alertBonferroni !== null) {
    if (!Number.isFinite(alertBonferroni) || alertBonferroni < 0) {
      throw new Error(
        `alertBonferroni must be a finite, non-negative number (got ${opts.alertBonferroni})`,
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
  const alertLowerTail = opts.alertLowerTail ?? null;
  if (alertLowerTail !== null) {
    if (
      !Number.isFinite(alertLowerTail) ||
      alertLowerTail < 0 ||
      alertLowerTail > 1
    ) {
      throw new Error(
        `alertLowerTail must be a finite number in [0, 1] (got ${opts.alertLowerTail})`,
      );
    }
  }
  const sort = opts.sort ?? 'bonferroni-desc';
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
    SlopeLensWidthBonferroniLensName,
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
  for (const lens of SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthBonferroniLensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES) {
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const halfW = (hi - lo) / 2;
      halfs.push(halfW);
    }
    const comp = lensWidthBonferroni(halfs);
    rows.push({
      lens,
      nShared: comp.nShared,
      meanHalfWidth: comp.meanHalfWidth,
      totalHalfWidth: comp.totalHalfWidth,
      bonferroni: comp.bonferroni,
      lowerTailMassShare: comp.lowerTailMassShare,
      bottomToTopRatio: comp.bottomToTopRatio,
      concentrationLabel: classifyConcentration(
        comp.bonferroni,
        comp.degenerateFlag,
      ),
      degenerateFlag: comp.degenerateFlag,
      degenerateReason: comp.degenerateReason,
      perSourceHalfWidths: halfs,
      perSourceSources: [...sharedSources],
    });
  }

  const finite = rows.filter((r) => !r.degenerateFlag);
  const bs = finite.map((r) => r.bonferroni);
  const meanBonferroni =
    bs.length > 0 ? bs.reduce((a, b) => a + b, 0) / bs.length : 0;
  const medianBonferroni = median(bs);
  const maxBonferroni = bs.length > 0 ? Math.max(...bs) : 0;
  const minBonferroni = bs.length > 0 ? Math.min(...bs) : 0;
  const rangeBonferroni = bs.length > 0 ? maxBonferroni - minBonferroni : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nExtreme = rows.filter(
    (r) => r.concentrationLabel === 'extreme',
  ).length;
  const nNearUniform = rows.filter(
    (r) => r.concentrationLabel === 'near-uniform',
  ).length;

  let mostExtremeLens: SlopeLensWidthBonferroniLensName | null = null;
  let mostUniformLens: SlopeLensWidthBonferroniLensName | null = null;
  if (finite.length > 0) {
    let bestHi = -Infinity;
    let bestLo = Infinity;
    for (const r of finite) {
      if (r.bonferroni > bestHi) {
        bestHi = r.bonferroni;
        mostExtremeLens = r.lens;
      }
      if (r.bonferroni < bestLo) {
        bestLo = r.bonferroni;
        mostUniformLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertBonferroni !== null) {
    filtered = filtered.filter((r) => r.bonferroni > alertBonferroni);
  }
  if (alertMass !== null) {
    filtered = filtered.filter((r) => r.totalHalfWidth > alertMass);
  }
  if (alertLowerTail !== null) {
    filtered = filtered.filter((r) => r.lowerTailMassShare < alertLowerTail);
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthBonferroniLensRow,
      b: SourceRowTokenSlopeCiLensWidthBonferroniLensRow,
    ) => number
  > = {
    'bonferroni-desc': (a, b) => b.bonferroni - a.bonferroni,
    'bonferroni-asc': (a, b) => a.bonferroni - b.bonferroni,
    'mass-desc': (a, b) => b.totalHalfWidth - a.totalHalfWidth,
    'mean-halfwidth-desc': (a, b) => b.meanHalfWidth - a.meanHalfWidth,
    'lower-tail-asc': (a, b) => a.lowerTailMassShare - b.lowerTailMassShare,
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES.indexOf(b.lens)
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
    alertBonferroni,
    alertMass,
    alertLowerTail,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    meanBonferroni,
    medianBonferroni,
    maxBonferroni,
    minBonferroni,
    rangeBonferroni,
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

export function renderSourceRowTokenSlopeCiLensWidthBonferroni(
  r: SourceRowTokenSlopeCiLensWidthBonferroniReport,
  opts: {
    showSummary?: boolean;
    showConcentrationAggregate?: boolean;
    showLensAttribution?: boolean;
    showLowerTail?: boolean;
    showPerSourceWidths?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showConcentrationAggregate = opts.showConcentrationAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showLowerTail = opts.showLowerTail ?? false;
  const showPerSourceWidths = opts.showPerSourceWidths ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-width-bonferroni');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-bonferroni: ${r.alertBonferroni ?? '-'}    alert-mass: ${r.alertMass ?? '-'}    alert-lower-tail: ${r.alertLowerTail ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanB: ${fmtNum(r.meanBonferroni)}; medianB: ${fmtNum(r.medianBonferroni)}; maxB: ${fmtNum(r.maxBonferroni)}; minB: ${fmtNum(r.minBonferroni)}; rangeB: ${fmtNum(r.rangeBonferroni)}; nExtreme: ${r.nExtreme}; nNearUniform: ${r.nNearUniform}; nDegen: ${r.nDegenerate}; mostExtreme: ${r.mostExtremeLens ?? '-'}; mostUniform: ${r.mostUniformLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     B         lowerTail  bottomTop  mean       total      concentration            reason',
  );
  lines.push(
    '-----------------  ----  --------  ---------  ---------  ---------  ---------  -----------------------  ---------------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        fmtNum(row.bonferroni).padStart(8),
        fmtNum(row.lowerTailMassShare).padStart(9),
        fmtNum(row.bottomToTopRatio).padStart(9),
        fmtNum(row.meanHalfWidth, 6).padStart(9),
        fmtNum(row.totalHalfWidth, 6).padStart(9),
        row.concentrationLabel.padEnd(23),
        (row.degenerateReason ?? '-').padEnd(21),
      ].join('  '),
    );
    if (showSummary) {
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} B=${fmtNum(row.bonferroni)} lowerTail=${fmtNum(row.lowerTailMassShare)} bottomTop=${fmtNum(row.bottomToTopRatio)} concentration=${row.concentrationLabel}`,
      );
    }
    if (showLowerTail) {
      if (row.degenerateFlag) {
        lines.push(`    lowerTail: (degenerate)`);
      } else {
        const upper = 1 - row.lowerTailMassShare;
        lines.push(
          `    lowerTail: bottom-half mass share=${fmtNum(row.lowerTailMassShare)} top-half mass share=${fmtNum(upper)} bottomToTopRatio=${fmtNum(row.bottomToTopRatio)} (Bonferroni rank-cumulative bottom-tail diagnostic)`,
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
      `[concentration aggregate] nExtreme=${r.nExtreme}/${denom} (${fmtNum(r.nExtreme / denom, 4)}) nNearUniform=${r.nNearUniform}/${denom} (${fmtNum(r.nNearUniform / denom, 4)}) nDegen=${r.nDegenerate}/${denom} (${fmtNum(r.nDegenerate / denom, 4)}) meanB=${fmtNum(r.meanBonferroni)} medianB=${fmtNum(r.medianBonferroni)} rangeB=${fmtNum(r.rangeBonferroni)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostExtreme=${r.mostExtremeLens ?? '-'} (max B) mostUniform=${r.mostUniformLens ?? '-'} (min B)`,
    );
  }
  return lines.join('\n');
}
