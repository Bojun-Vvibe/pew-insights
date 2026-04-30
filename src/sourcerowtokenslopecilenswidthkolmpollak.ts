/**
 * source-row-token-slope-ci-lens-width-kolm-pollak
 *
 * Per-lens CROSS-SOURCE KOLM-POLLAK INDEX of CI half-widths
 * (TWENTY-NINTH cross-lens axis) for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six per-source
 * slope CIs as v0.6.227-v0.6.259 (percentile bootstrap, jackknife
 * normal, BCa, studentized-t, ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL TWENTY-EIGHT prior cross-lens
 * diagnostics on a fundamentally different invariance axis:
 *
 *   1. INVARIANCE FAMILY. Kolm (1976), Pollak (1971), and Atkinson-
 *      Stiglitz (1980) introduced the Kolm-Pollak index as the
 *      canonical CONSTANT-ABSOLUTE-INEQUALITY counterpart to all the
 *      scale-invariant (relative) inequality measures. The defining
 *      property is TRANSLATION INVARIANCE: adding the same constant
 *      to every observation leaves K unchanged. Equivalently, K
 *      satisfies the LEFTIST equity axiom -- a fixed ABSOLUTE
 *      transfer matters equally regardless of the receiver's level,
 *      whereas Gini/Theil/Atkinson/Bonferroni satisfy the
 *      RIGHTIST axiom (a fixed PROPORTIONAL transfer matters
 *      equally).
 *
 *      Definition (alpha > 0; we expose alpha=1 by default):
 *
 *        Xi_alpha = -(1/alpha) * log( (1/n) * sum_i exp(-alpha*x_i) )
 *        K_alpha  = mean(x) - Xi_alpha
 *
 *      Xi_alpha is the equally-distributed-equivalent (EDE) under
 *      the EXPONENTIAL utility u(x) = -exp(-alpha*x); K_alpha is
 *      the welfare-loss gap (mean minus EDE) measured in the SAME
 *      UNITS as x. K_alpha >= 0 with equality iff all x_i identical.
 *
 *   2. ORTHOGONAL TO AXES 21-28. Every prior axis (21 Gini, 22 Theil,
 *      23 Atkinson, 24 QCD, 25 Hoover, 26 Palma, 27 GE(2),
 *      28 Bonferroni) is SCALE-INVARIANT: scaling all half-widths
 *      by a constant c leaves the index unchanged. Kolm-Pollak is
 *      TRANSLATION-INVARIANT instead: adding c to every half-width
 *      leaves K unchanged but scaling by c MULTIPLIES K by c. This
 *      is a genuinely different functional family -- the Kolm-Pollak
 *      welfare-loss gap K reacts to ABSOLUTE differences whereas
 *      axes 21-28 react to RELATIVE differences. A pair of
 *      half-widths (1, 2) and (1001, 1002) have identical Gini
 *      (0.167) but different Kolm-Pollak (the latter has K -> 0
 *      as alpha*c grows because exp(-alpha*x) flattens).
 *      Conversely, scaling (1, 2) -> (10, 20) leaves all axes
 *      21-28 fixed but raises K by exactly 10x at alpha=1.
 *
 *   3. UNIT-CARRYING. Unlike ALL prior cross-lens axes (which are
 *      dimensionless ratios in [0, 1] or [0, +inf)), K_alpha
 *      carries the SAME units as the half-widths themselves. This
 *      makes the per-lens K directly comparable to the meanHalfWidth
 *      column on the same row (the ratio K / mean is reported as a
 *      derived diagnostic `kolmRelativeIntensity`).
 *
 *   4. SENSITIVITY KNOB. The aversion parameter alpha controls
 *      bottom-tail sensitivity exponentially: as alpha -> 0+,
 *      K_alpha -> 0 (no aversion); as alpha -> +inf, K_alpha ->
 *      mean - min (Rawlsian limit). We expose alpha as an option
 *      (default 1) AND report the Rawlsian deficit
 *      `rawlsianDeficit = mean - min(x)` as an upper-bound
 *      diagnostic on every row.
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.259. For each lens L:
 *
 *   For each source s in the SHARED set (sources present in ALL
 *   six lens reports):
 *     halfWidth_{L,s} = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *
 *   With n >= 4:
 *     mean = (1/n) * sum_i halfWidth
 *     Xi   = -(1/alpha) * log( (1/n) * sum_i exp(-alpha * halfWidth) )
 *     K    = mean - Xi
 *
 *   Numerical safety: we compute the inner log-sum-exp using the
 *   max-subtraction trick (let m = max_i (-alpha*halfWidth) and
 *   factor exp(m) out of the sum) so exp underflow is impossible
 *   for any non-negative input. This makes K finite for ALL valid
 *   non-negative half-widths regardless of magnitude.
 *
 *   Edge cases (parity with axes 21-28):
 *     - n < 4: K = 0, degenerateFlag = true,
 *              reason = 'too-few-sources'.
 *     - All half-widths identical: K = 0 exactly (NOT degenerate).
 *     - Any half-width is negative or non-finite: throws.
 *     - non-finite intermediate sum: degenerateFlag = true,
 *       reason = 'non-finite'.
 *
 * Per-lens columns:
 *   - `lens`                    -- canonical lens name
 *   - `nShared`                 -- number of shared sources used
 *   - `meanHalfWidth`           -- arithmetic mean of half-widths
 *   - `minHalfWidth`            -- min half-width across sources
 *   - `maxHalfWidth`            -- max half-width across sources
 *   - `kolmPollak`              -- K_alpha in same units as halfW
 *   - `equallyDistributedEquivalent` -- Xi_alpha = mean - K
 *   - `kolmRelativeIntensity`   -- K / mean (dimensionless ratio)
 *   - `rawlsianDeficit`         -- mean - min (Rawlsian upper bound)
 *   - `concentrationLabel`      -- qualitative bin on
 *                                  `kolmRelativeIntensity`:
 *                                  'extreme'           (>= 0.5)
 *                                  'high'              ([0.2, 0.5))
 *                                  'moderate'          ([0.05, 0.2))
 *                                  'mild'              ((0, 0.05))
 *                                  'near-uniform'      (== 0)
 *                                  'degenerate'        (degenerateFlag)
 *   - `degenerateFlag`          -- true iff hit an edge case
 *   - `degenerateReason`        -- reason string, or null
 *
 * Report-level: meanK, medianK, maxK, minK, rangeK, nDegenerate,
 * nExtreme, nNearUniform, mostExtremeLens (argmax K),
 * mostUniformLens (argmin K).
 *
 * Filters:
 *   - --alert-kolm <f>           -- keep lenses with K > f (f >= 0)
 *   - --alert-relative <f>       -- keep lenses with kolmRelativeIntensity > f
 *   - --alert-rawls <f>          -- keep lenses with rawlsianDeficit > f
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_KOLM_POLLAK_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthKolmPollakLensName =
  (typeof SLOPE_LENS_WIDTH_KOLM_POLLAK_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 4;

// Bin thresholds on kolmRelativeIntensity = K / mean.
const EXTREME_THRESHOLD = 0.5;
const HIGH_THRESHOLD = 0.2;
const MODERATE_THRESHOLD = 0.05;

export type KolmPollakDegenerateReason =
  | 'too-few-sources'
  | 'non-finite';

export type KolmPollakConcentrationLabel =
  | 'extreme'
  | 'high'
  | 'moderate'
  | 'mild'
  | 'near-uniform'
  | 'degenerate';

export interface SourceRowTokenSlopeCiLensWidthKolmPollakOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alpha?: number;
  alertKolm?: number | null;
  alertRelative?: number | null;
  alertRawls?: number | null;
  sort?:
    | 'kolm-desc'
    | 'kolm-asc'
    | 'relative-desc'
    | 'rawls-desc'
    | 'mean-halfwidth-desc'
    | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthKolmPollakLensRow {
  lens: SlopeLensWidthKolmPollakLensName;
  nShared: number;
  meanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  kolmPollak: number;
  equallyDistributedEquivalent: number;
  kolmRelativeIntensity: number;
  rawlsianDeficit: number;
  concentrationLabel: KolmPollakConcentrationLabel;
  degenerateFlag: boolean;
  degenerateReason: KolmPollakDegenerateReason | null;
  perSourceHalfWidths: number[];
  perSourceSources: string[];
}

export interface SourceRowTokenSlopeCiLensWidthKolmPollakReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alpha: number;
  alertKolm: number | null;
  alertRelative: number | null;
  alertRawls: number | null;
  sort: NonNullable<
    SourceRowTokenSlopeCiLensWidthKolmPollakOptions['sort']
  >;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  meanK: number;
  medianK: number;
  maxK: number;
  minK: number;
  rangeK: number;
  nDegenerate: number;
  nExtreme: number;
  nNearUniform: number;
  mostExtremeLens: SlopeLensWidthKolmPollakLensName | null;
  mostUniformLens: SlopeLensWidthKolmPollakLensName | null;
  rows: SourceRowTokenSlopeCiLensWidthKolmPollakLensRow[];
}

const VALID_SORTS = [
  'kolm-desc',
  'kolm-asc',
  'relative-desc',
  'rawls-desc',
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
  relativeIntensity: number,
  degenerate: boolean,
): KolmPollakConcentrationLabel {
  if (degenerate) return 'degenerate';
  if (!Number.isFinite(relativeIntensity) || relativeIntensity <= 0)
    return 'near-uniform';
  if (relativeIntensity >= EXTREME_THRESHOLD) return 'extreme';
  if (relativeIntensity >= HIGH_THRESHOLD) return 'high';
  if (relativeIntensity >= MODERATE_THRESHOLD) return 'moderate';
  return 'mild';
}

/**
 * Compute the KOLM-POLLAK INDEX K_alpha on a single set of
 * non-negative half-widths.
 *
 *   Xi_alpha = -(1/alpha) * log( (1/n) * sum_i exp(-alpha*x_i) )
 *   K_alpha  = mean(x) - Xi_alpha
 *
 * Numerical safety: log-sum-exp is computed with the standard
 * max-subtraction trick. Let z_i = -alpha * x_i and
 * m = max_i z_i. Then
 *   log( (1/n) * sum_i exp(z_i) )
 *     = m + log( (1/n) * sum_i exp(z_i - m) )
 * and Xi_alpha = -(1/alpha) * (m + log_sum_norm). Every
 * `exp(z_i - m)` is in (0, 1] so no overflow / underflow occurs
 * for any non-negative half-width regardless of alpha or
 * magnitude.
 *
 * Returns degenerate metadata for the standard edge cases. Also
 * returns `kolmRelativeIntensity` (K / mean), `rawlsianDeficit`
 * (mean - min), and the Xi value itself.
 *
 * Exposed for direct unit-testing.
 */
export function lensWidthKolmPollak(
  halfWidths: number[],
  alpha: number,
): {
  nShared: number;
  meanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  kolmPollak: number;
  equallyDistributedEquivalent: number;
  kolmRelativeIntensity: number;
  rawlsianDeficit: number;
  degenerateFlag: boolean;
  degenerateReason: KolmPollakDegenerateReason | null;
} {
  if (!Number.isFinite(alpha) || alpha <= 0) {
    throw new Error(
      `lensWidthKolmPollak: alpha must be a finite, strictly positive number (got ${alpha})`,
    );
  }
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthKolmPollak: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthKolmPollak: halfWidths must be non-negative (got ${v})`,
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
      kolmPollak: 0,
      equallyDistributedEquivalent: 0,
      kolmRelativeIntensity: 0,
      rawlsianDeficit: 0,
      degenerateFlag: true,
      degenerateReason: 'too-few-sources',
    };
  }
  let total = 0;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const v of halfWidths) {
    total += v;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  if (!Number.isFinite(total)) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      minHalfWidth: minV,
      maxHalfWidth: maxV,
      kolmPollak: 0,
      equallyDistributedEquivalent: 0,
      kolmRelativeIntensity: 0,
      rawlsianDeficit: 0,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  const mean = total / n;

  // Log-sum-exp with max subtraction: z_i = -alpha*x_i; m = max z_i.
  // For non-negative x and alpha > 0, z_i <= 0 so m <= 0.
  let m = -Infinity;
  for (const v of halfWidths) {
    const z = -alpha * v;
    if (z > m) m = z;
  }
  let sumExp = 0;
  for (const v of halfWidths) {
    sumExp += Math.exp(-alpha * v - m);
  }
  if (!Number.isFinite(sumExp) || sumExp <= 0) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      minHalfWidth: minV,
      maxHalfWidth: maxV,
      kolmPollak: 0,
      equallyDistributedEquivalent: 0,
      kolmRelativeIntensity: 0,
      rawlsianDeficit: mean - minV,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  const logMean = m + Math.log(sumExp / n);
  const xi = -logMean / alpha;
  let k = mean - xi;
  if (!Number.isFinite(k)) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      minHalfWidth: minV,
      maxHalfWidth: maxV,
      kolmPollak: 0,
      equallyDistributedEquivalent: 0,
      kolmRelativeIntensity: 0,
      rawlsianDeficit: mean - minV,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  // Numerical floor: K is theoretically >= 0 (Jensen). Clip tiny
  // negative values arising from FP rounding.
  if (k < 0 && k > -1e-12) k = 0;
  // Upper bound: Rawlsian deficit = mean - min. Clip if FP drifts.
  const rawls = mean - minV;
  if (k > rawls && k - rawls < 1e-9) k = rawls;

  const relIntensity = mean > 0 ? k / mean : 0;

  return {
    nShared: n,
    meanHalfWidth: mean,
    minHalfWidth: minV,
    maxHalfWidth: maxV,
    kolmPollak: k,
    equallyDistributedEquivalent: xi,
    kolmRelativeIntensity: relIntensity,
    rawlsianDeficit: rawls,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

export function buildSourceRowTokenSlopeCiLensWidthKolmPollak(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthKolmPollakOptions = {},
): SourceRowTokenSlopeCiLensWidthKolmPollakReport {
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
  const alpha = opts.alpha ?? 1;
  if (!Number.isFinite(alpha) || alpha <= 0) {
    throw new Error(
      `alpha must be a finite, strictly positive number (got ${opts.alpha})`,
    );
  }
  const alertKolm = opts.alertKolm ?? null;
  if (alertKolm !== null) {
    if (!Number.isFinite(alertKolm) || alertKolm < 0) {
      throw new Error(
        `alertKolm must be a finite, non-negative number (got ${opts.alertKolm})`,
      );
    }
  }
  const alertRelative = opts.alertRelative ?? null;
  if (alertRelative !== null) {
    if (!Number.isFinite(alertRelative) || alertRelative < 0) {
      throw new Error(
        `alertRelative must be a finite, non-negative number (got ${opts.alertRelative})`,
      );
    }
  }
  const alertRawls = opts.alertRawls ?? null;
  if (alertRawls !== null) {
    if (!Number.isFinite(alertRawls) || alertRawls < 0) {
      throw new Error(
        `alertRawls must be a finite, non-negative number (got ${opts.alertRawls})`,
      );
    }
  }
  const sort = opts.sort ?? 'kolm-desc';
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
    SlopeLensWidthKolmPollakLensName,
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
  for (const lens of SLOPE_LENS_WIDTH_KOLM_POLLAK_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_KOLM_POLLAK_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthKolmPollakLensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_KOLM_POLLAK_LENS_NAMES) {
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const halfW = (hi - lo) / 2;
      halfs.push(halfW);
    }
    const comp = lensWidthKolmPollak(halfs, alpha);
    rows.push({
      lens,
      nShared: comp.nShared,
      meanHalfWidth: comp.meanHalfWidth,
      minHalfWidth: comp.minHalfWidth,
      maxHalfWidth: comp.maxHalfWidth,
      kolmPollak: comp.kolmPollak,
      equallyDistributedEquivalent: comp.equallyDistributedEquivalent,
      kolmRelativeIntensity: comp.kolmRelativeIntensity,
      rawlsianDeficit: comp.rawlsianDeficit,
      concentrationLabel: classifyConcentration(
        comp.kolmRelativeIntensity,
        comp.degenerateFlag,
      ),
      degenerateFlag: comp.degenerateFlag,
      degenerateReason: comp.degenerateReason,
      perSourceHalfWidths: halfs,
      perSourceSources: [...sharedSources],
    });
  }

  const finite = rows.filter((r) => !r.degenerateFlag);
  const ks = finite.map((r) => r.kolmPollak);
  const meanK =
    ks.length > 0 ? ks.reduce((a, b) => a + b, 0) / ks.length : 0;
  const medianK = median(ks);
  const maxK = ks.length > 0 ? Math.max(...ks) : 0;
  const minK = ks.length > 0 ? Math.min(...ks) : 0;
  const rangeK = ks.length > 0 ? maxK - minK : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nExtreme = rows.filter(
    (r) => r.concentrationLabel === 'extreme',
  ).length;
  const nNearUniform = rows.filter(
    (r) => r.concentrationLabel === 'near-uniform',
  ).length;

  let mostExtremeLens: SlopeLensWidthKolmPollakLensName | null = null;
  let mostUniformLens: SlopeLensWidthKolmPollakLensName | null = null;
  if (finite.length > 0) {
    let bestHi = -Infinity;
    let bestLo = Infinity;
    for (const r of finite) {
      if (r.kolmPollak > bestHi) {
        bestHi = r.kolmPollak;
        mostExtremeLens = r.lens;
      }
      if (r.kolmPollak < bestLo) {
        bestLo = r.kolmPollak;
        mostUniformLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertKolm !== null) {
    filtered = filtered.filter((r) => r.kolmPollak > alertKolm);
  }
  if (alertRelative !== null) {
    filtered = filtered.filter((r) => r.kolmRelativeIntensity > alertRelative);
  }
  if (alertRawls !== null) {
    filtered = filtered.filter((r) => r.rawlsianDeficit > alertRawls);
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthKolmPollakLensRow,
      b: SourceRowTokenSlopeCiLensWidthKolmPollakLensRow,
    ) => number
  > = {
    'kolm-desc': (a, b) => b.kolmPollak - a.kolmPollak,
    'kolm-asc': (a, b) => a.kolmPollak - b.kolmPollak,
    'relative-desc': (a, b) =>
      b.kolmRelativeIntensity - a.kolmRelativeIntensity,
    'rawls-desc': (a, b) => b.rawlsianDeficit - a.rawlsianDeficit,
    'mean-halfwidth-desc': (a, b) => b.meanHalfWidth - a.meanHalfWidth,
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_KOLM_POLLAK_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_KOLM_POLLAK_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_KOLM_POLLAK_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_KOLM_POLLAK_LENS_NAMES.indexOf(b.lens)
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
    alpha,
    alertKolm,
    alertRelative,
    alertRawls,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    meanK,
    medianK,
    maxK,
    minK,
    rangeK,
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

export function renderSourceRowTokenSlopeCiLensWidthKolmPollak(
  r: SourceRowTokenSlopeCiLensWidthKolmPollakReport,
  opts: {
    showSummary?: boolean;
    showConcentrationAggregate?: boolean;
    showLensAttribution?: boolean;
    showRawlsianBound?: boolean;
    showPerSourceWidths?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showConcentrationAggregate = opts.showConcentrationAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showRawlsianBound = opts.showRawlsianBound ?? false;
  const showPerSourceWidths = opts.showPerSourceWidths ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-width-kolm-pollak');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alpha: ${r.alpha}    alert-kolm: ${r.alertKolm ?? '-'}    alert-relative: ${r.alertRelative ?? '-'}    alert-rawls: ${r.alertRawls ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanK: ${fmtNum(r.meanK, 6)}; medianK: ${fmtNum(r.medianK, 6)}; maxK: ${fmtNum(r.maxK, 6)}; minK: ${fmtNum(r.minK, 6)}; rangeK: ${fmtNum(r.rangeK, 6)}; nExtreme: ${r.nExtreme}; nNearUniform: ${r.nNearUniform}; nDegen: ${r.nDegenerate}; mostExtreme: ${r.mostExtremeLens ?? '-'}; mostUniform: ${r.mostUniformLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     K          Xi         relK       rawls      mean       min        max        concentration       reason',
  );
  lines.push(
    '-----------------  ----  ---------  ---------  ---------  ---------  ---------  ---------  ---------  ------------------  ---------------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        fmtNum(row.kolmPollak, 6).padStart(9),
        fmtNum(row.equallyDistributedEquivalent, 6).padStart(9),
        fmtNum(row.kolmRelativeIntensity).padStart(9),
        fmtNum(row.rawlsianDeficit, 6).padStart(9),
        fmtNum(row.meanHalfWidth, 6).padStart(9),
        fmtNum(row.minHalfWidth, 6).padStart(9),
        fmtNum(row.maxHalfWidth, 6).padStart(9),
        row.concentrationLabel.padEnd(18),
        (row.degenerateReason ?? '-').padEnd(21),
      ].join('  '),
    );
    if (showSummary) {
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} K=${fmtNum(row.kolmPollak, 6)} Xi=${fmtNum(row.equallyDistributedEquivalent, 6)} relK=${fmtNum(row.kolmRelativeIntensity)} concentration=${row.concentrationLabel}`,
      );
    }
    if (showRawlsianBound) {
      if (row.degenerateFlag) {
        lines.push(`    rawlsianBound: (degenerate)`);
      } else {
        const slack = row.rawlsianDeficit - row.kolmPollak;
        const ratio =
          row.rawlsianDeficit > 0 ? row.kolmPollak / row.rawlsianDeficit : 0;
        lines.push(
          `    rawlsianBound: K=${fmtNum(row.kolmPollak, 6)} <= rawls=${fmtNum(row.rawlsianDeficit, 6)} (slack=${fmtNum(slack, 6)} ratio=${fmtNum(ratio)} alpha=${r.alpha})`,
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
      `[concentration aggregate] nExtreme=${r.nExtreme}/${denom} (${fmtNum(r.nExtreme / denom, 4)}) nNearUniform=${r.nNearUniform}/${denom} (${fmtNum(r.nNearUniform / denom, 4)}) nDegen=${r.nDegenerate}/${denom} (${fmtNum(r.nDegenerate / denom, 4)}) meanK=${fmtNum(r.meanK, 6)} medianK=${fmtNum(r.medianK, 6)} rangeK=${fmtNum(r.rangeK, 6)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostExtreme=${r.mostExtremeLens ?? '-'} (max K) mostUniform=${r.mostUniformLens ?? '-'} (min K)`,
    );
  }
  return lines.join('\n');
}
