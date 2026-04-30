/**
 * source-row-token-slope-ci-lens-width-sgini
 *
 * Per-lens CROSS-SOURCE DONALDSON-WEYMARK S-GINI (extended Gini)
 * coefficient G(nu) of CI half-widths, evaluated at the FIXED
 * inequality-aversion parameter nu = 3 (THIRTY-FIRST cross-lens
 * axis). Consumes the SAME six per-source slope CIs as v0.6.227-
 * v0.6.263 (percentile bootstrap, jackknife normal, BCa,
 * studentized-t, ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL THIRTY prior cross-lens
 * diagnostics on the following ORTHOGONAL axes:
 *
 *   1. STATISTIC FAMILY. The S-Gini (Donaldson-Weymark 1980,
 *      Yitzhaki 1983) is a RANK-WEIGHTED Lorenz-gap functional
 *      with a tunable inequality-aversion parameter nu >= 1:
 *
 *        G(nu) = nu * (nu - 1) * integral_0^1 (1 - p)^(nu - 2)
 *                * (p - L(p)) dp
 *
 *      The kernel w_nu(p) = nu*(nu-1)*(1-p)^(nu-2) integrates the
 *      SAME Lorenz GAP (p - L(p)) as Gini (axis-21), Mehran
 *      (axis-30), and Bonferroni (axis-28), but with the kernel
 *      EXPONENT in the rank-weight rather than a fixed kernel.
 *
 *      We fix nu = 3 in this axis. At nu = 3 the kernel is
 *      w_3(p) = 6*(1 - p), which puts STRICTLY MORE weight on the
 *      bottom of the distribution than the classical Gini's
 *      uniform kernel (axis-21) but LESS than the unbounded
 *      harmonic 1/p of Bonferroni (axis-28).
 *
 *      Numerical observation: w_3 = 6(1-p) is six times larger at
 *      p = 0 than the Gini uniform kernel w_2 = 1, so a single
 *      poorly-precise (large half-width) source whose RANK is the
 *      smallest gets 6x the effective weight under S-Gini(3) it
 *      gets under Gini. This makes S-Gini(3) a BOTTOM-TAIL-
 *      SENSITIVITY DIAL.
 *
 *      We compute G(nu=3) numerically by Simpson's-rule on the
 *      empirical step Lorenz curve. On each rank step the
 *      integrand 6*(1-p)*(p - L(p)) is the product of a linear
 *      kernel and a linear gap -> quadratic, so Simpson's rule is
 *      EXACT (zero truncation error) at nu = 3, identical to the
 *      Mehran-axis exactness. Bounded in [0, 1] for any
 *      non-negative input by the Lorenz dominance L(p) <= p.
 *      G(nu) = 0 iff perfectly equal; G(nu) -> 1 - 1/n iff
 *      perfect concentration on a single observation.
 *
 *   2. RELATIONSHIP TO MEHRAN (axis-30). The Mehran functional is
 *
 *        M = 6 * integral_0^1 (1 - p) * (p - L(p)) dp
 *
 *      and S-Gini at nu = 3 is
 *
 *        G(3) = 6 * integral_0^1 (1 - p) * (p - L(p)) dp
 *
 *      which means S-Gini(3) IS NUMERICALLY IDENTICAL to Mehran.
 *      That is the well-known degeneracy at this exact nu.
 *
 *      To preserve ORTHOGONALITY against axis-30 we therefore
 *      report S-Gini at nu = 3 as a THREE-PARAMETER FAMILY
 *      DIAGNOSTIC: in addition to G(3), this axis emits the
 *      ELASTICITY of G(nu) at the operating point nu = 3 -- a
 *      LOCAL DERIVATIVE that is NOT computable from any single
 *      Lorenz-gap functional in the prior 30 axes:
 *
 *        elasticity = (d ln G(nu) / d ln nu) | nu=3
 *
 *      The elasticity quantifies how SENSITIVE the inequality
 *      verdict at nu = 3 is to small perturbations in the chosen
 *      inequality-aversion parameter. Two distributions can have
 *      the SAME G(3) but different elasticities -- e.g. a
 *      bottom-loaded skew vs a flat-but-spread distribution. Two
 *      distributions can also have the SAME Gini (G(2)) and the
 *      SAME Mehran (G(3)) but DIFFERENT G(2.5) or G(4),
 *      witnessing that the elasticity is a NON-REDUNDANT
 *      orthogonal measurement.
 *
 *      We compute the elasticity by central finite difference at
 *      nu = 3 with step h = 0.25:
 *
 *        elasticity ~= (ln G(3.25) - ln G(2.75)) / (ln 3.25 - ln 2.75)
 *
 *      Both endpoints use the same Simpson-on-piecewise-linears
 *      method as the centre and are exact for piecewise-linear
 *      Lorenz curves up to FP truncation.
 *
 *   3. ORTHOGONAL TO EVERY PRIOR AXIS (other than the noted
 *      G(3) == Mehran identity, which is documented above):
 *
 *        - axis-21 Gini: G(2) recovers it.
 *        - axis-22 Theil GE(1): entropic, NOT a Lorenz-gap integral.
 *        - axis-23 Atkinson(eps): CRRA welfare-loss curvature,
 *          family parameter on UTILITY rather than on RANK.
 *        - axis-24 QCD: order-statistic ratio on two quartile
 *          points only.
 *        - axis-25 Hoover: L_infinity gap.
 *        - axis-26 Palma: TWO-POINT decile ratio.
 *        - axis-27 GE(2): variance-based, top-tail-sensitive.
 *        - axis-28 Bonferroni: rank-cumulative 1/i prefix-mean
 *          (UNBOUNDED kernel at p->0).
 *        - axis-29 Kolm-Pollak: TRANSLATION-INVARIANT exponential
 *          welfare-loss gap.
 *        - axis-30 Mehran: G(3) is identically Mehran. We escape
 *          redundancy by emitting the LOCAL ELASTICITY at nu = 3,
 *          which Mehran cannot produce on its own.
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.263. For each lens L:
 *
 *   For each source s in the SHARED set (sources present in ALL
 *   six lens reports):
 *     halfWidth_{L,s} = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *
 *   With n >= 4 and mean m > 0:
 *     G(nu) = nu * (nu - 1) * integral_0^1 (1 - p)^(nu - 2)
 *             * (p - L(p)) dp
 *
 *   Edge cases (parity with axes 21-30):
 *     - n < 4: G = 0, degenerateFlag = true,
 *              reason = 'too-few-sources'.
 *     - mean <= 0: G = 0, degenerateFlag = true,
 *              reason = 'zero-mean'.
 *     - All half-widths identical: G = 0 exactly (NOT degenerate).
 *     - Any half-width is negative or non-finite: throws.
 *
 * Per-lens columns:
 *   - `lens`                    -- canonical lens name
 *   - `nShared`                 -- number of shared sources used
 *   - `meanHalfWidth`           -- arithmetic mean of half-widths
 *   - `minHalfWidth`            -- min half-width across sources
 *   - `maxHalfWidth`            -- max half-width across sources
 *   - `sgini`                   -- G(nu=3) in [0, 1]
 *   - `nu`                      -- the operating-point nu (always 3)
 *   - `elasticity`              -- (d ln G / d ln nu) at nu = 3,
 *                                  computed by central FD with h=0.25
 *   - `gNuLow`                  -- G(2.75), the lower elasticity endpoint
 *   - `gNuHigh`                 -- G(3.25), the upper elasticity endpoint
 *   - `concentrationLabel`      -- qualitative bin on G(3):
 *                                  'extreme'           (>= 0.6)
 *                                  'high'              ([0.3, 0.6))
 *                                  'moderate'          ([0.1, 0.3))
 *                                  'mild'              ((0, 0.1))
 *                                  'near-uniform'      (== 0)
 *                                  'degenerate'        (degenerateFlag)
 *   - `degenerateFlag`          -- true iff hit an edge case
 *   - `degenerateReason`        -- reason string, or null
 *
 * Report-level: meanG, medianG, maxG, minG, rangeG, nDegenerate,
 * nExtreme, nNearUniform, mostExtremeLens (argmax G),
 * mostUniformLens (argmin G).
 *
 * Filters:
 *   - --alert-sgini <f>          -- keep lenses with G(3) > f (f in [0, 1])
 *
 * Sorts: 'sgini-desc' (default), 'sgini-asc',
 *        'mean-halfwidth-desc', 'lens'.
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_SGINI_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthSGiniLensName =
  (typeof SLOPE_LENS_WIDTH_SGINI_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 4;

const EXTREME_THRESHOLD = 0.6;
const HIGH_THRESHOLD = 0.3;
const MODERATE_THRESHOLD = 0.1;

const FIXED_NU = 3;
const ELASTICITY_H = 0.25;

export type SGiniDegenerateReason = 'too-few-sources' | 'zero-mean';

export type SGiniConcentrationLabel =
  | 'extreme'
  | 'high'
  | 'moderate'
  | 'mild'
  | 'near-uniform'
  | 'degenerate';

export interface SourceRowTokenSlopeCiLensWidthSGiniOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertSgini?: number | null;
  sort?: 'sgini-desc' | 'sgini-asc' | 'mean-halfwidth-desc' | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthSGiniLensRow {
  lens: SlopeLensWidthSGiniLensName;
  nShared: number;
  meanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  sgini: number;
  nu: number;
  elasticity: number;
  gNuLow: number;
  gNuHigh: number;
  concentrationLabel: SGiniConcentrationLabel;
  degenerateFlag: boolean;
  degenerateReason: SGiniDegenerateReason | null;
  perSourceHalfWidths: number[];
  perSourceSources: string[];
}

export interface SourceRowTokenSlopeCiLensWidthSGiniReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertSgini: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiLensWidthSGiniOptions['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  nu: number;
  meanG: number;
  medianG: number;
  maxG: number;
  minG: number;
  rangeG: number;
  nDegenerate: number;
  nExtreme: number;
  nNearUniform: number;
  mostExtremeLens: SlopeLensWidthSGiniLensName | null;
  mostUniformLens: SlopeLensWidthSGiniLensName | null;
  rows: SourceRowTokenSlopeCiLensWidthSGiniLensRow[];
}

const VALID_SORTS = [
  'sgini-desc',
  'sgini-asc',
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
  g: number,
  degenerate: boolean,
): SGiniConcentrationLabel {
  if (degenerate) return 'degenerate';
  if (!Number.isFinite(g) || g <= 0) return 'near-uniform';
  if (g >= EXTREME_THRESHOLD) return 'extreme';
  if (g >= HIGH_THRESHOLD) return 'high';
  if (g >= MODERATE_THRESHOLD) return 'moderate';
  return 'mild';
}

/**
 * Compute S-Gini G(nu) on a sorted-ascending non-negative
 * half-width vector. Pure helper, exposed for testing.
 *
 *   G(nu) = nu * (nu - 1) * integral_0^1 (1 - p)^(nu - 2)
 *           * (p - L(p)) dp
 *
 * For nu = 2 recovers the classical Gini. For nu = 3 recovers the
 * Mehran (axis-30) identity 6 * integral (1-p) * (p - L(p)) dp.
 *
 * Numerics: Simpson sub-intervals per rank step. At integer
 * nu in {2, 3} the integrand is piecewise quadratic and Simpson
 * is exact in 1 subinterval; for non-integer nu we use 64
 * subintervals per rank step (truncation error O(h^4) << 1e-9).
 */
export function lensWidthSGiniAtNu(
  halfWidths: number[],
  nu: number,
): number | null {
  if (!Number.isFinite(nu) || nu <= 1) {
    throw new Error(`lensWidthSGiniAtNu: nu must be a finite > 1 (got ${nu})`);
  }
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthSGiniAtNu: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthSGiniAtNu: halfWidths must be non-negative (got ${v})`,
      );
    }
  }
  const n = halfWidths.length;
  if (n < MIN_SHARED_SOURCES) return null;
  let total = 0;
  for (const v of halfWidths) total += v;
  const mean = total / n;
  if (!(mean > 0) || !Number.isFinite(mean)) return null;

  const sorted = [...halfWidths].sort((a, b) => a - b);
  let cumulative = 0;
  const cumNorm: number[] = [0];
  for (let i = 0; i < n; i++) {
    cumulative += sorted[i]!;
    cumNorm.push(cumulative / (n * mean));
  }
  const lorenzAt = (p: number): number => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    const fIdx = p * n;
    const lo = Math.floor(fIdx);
    const hi = lo + 1;
    if (hi > n) return 1;
    const frac = fIdx - lo;
    return cumNorm[lo]! + frac * (cumNorm[hi]! - cumNorm[lo]!);
  };
  // For nu in {2, 3} the integrand is exact under 1 Simpson subinterval per
  // rank step. For other nu we use 64 subintervals to keep truncation error
  // tightly bounded.
  const nuExact = Math.abs(nu - 2) < 1e-12 || Math.abs(nu - 3) < 1e-12;
  const subdiv = nuExact ? 1 : 64;
  let acc = 0;
  for (let i = 1; i <= n; i++) {
    const pStart = (i - 1) / n;
    const pEnd = i / n;
    const h = (pEnd - pStart) / subdiv;
    for (let k = 0; k < subdiv; k++) {
      const a0 = pStart + k * h;
      const a1 = a0 + h;
      const am = a0 + h / 2;
      const k0 = Math.pow(1 - a0, nu - 2);
      const km = Math.pow(1 - am, nu - 2);
      const k1 = Math.pow(1 - a1, nu - 2);
      const f0 = k0 * (a0 - lorenzAt(a0));
      const fm = km * (am - lorenzAt(am));
      const f1 = k1 * (a1 - lorenzAt(a1));
      acc += (h / 6) * (f0 + 4 * fm + f1);
    }
  }
  let g = nu * (nu - 1) * acc;
  if (g < 0 && g > -1e-9) g = 0;
  if (g > 1 && g - 1 < 1e-6) g = 1;
  return g;
}

/**
 * Compute S-Gini at the FIXED operating point nu = 3, plus the
 * elasticity (d ln G / d ln nu) at nu = 3 by central FD.
 */
export function lensWidthSGini(halfWidths: number[]): {
  nShared: number;
  meanHalfWidth: number;
  minHalfWidth: number;
  maxHalfWidth: number;
  sgini: number;
  nu: number;
  elasticity: number;
  gNuLow: number;
  gNuHigh: number;
  degenerateFlag: boolean;
  degenerateReason: SGiniDegenerateReason | null;
} {
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthSGini: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthSGini: halfWidths must be non-negative (got ${v})`,
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
      sgini: 0,
      nu: FIXED_NU,
      elasticity: 0,
      gNuLow: 0,
      gNuHigh: 0,
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
  const mean = total / n;
  if (!(mean > 0) || !Number.isFinite(mean)) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      minHalfWidth: minV,
      maxHalfWidth: maxV,
      sgini: 0,
      nu: FIXED_NU,
      elasticity: 0,
      gNuLow: 0,
      gNuHigh: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-mean',
    };
  }
  const g = lensWidthSGiniAtNu(halfWidths, FIXED_NU)!;
  const gLow = lensWidthSGiniAtNu(halfWidths, FIXED_NU - ELASTICITY_H)!;
  const gHigh = lensWidthSGiniAtNu(halfWidths, FIXED_NU + ELASTICITY_H)!;
  let elasticity = 0;
  // Use a robust epsilon floor so FP-noise on a uniform Lorenz curve
  // (gLow, gHigh ~ 1e-17) does not produce spurious elasticity.
  const ELAST_EPS = 1e-12;
  if (gLow > ELAST_EPS && gHigh > ELAST_EPS) {
    const dLnG = Math.log(gHigh) - Math.log(gLow);
    const dLnNu =
      Math.log(FIXED_NU + ELASTICITY_H) - Math.log(FIXED_NU - ELASTICITY_H);
    elasticity = dLnG / dLnNu;
  }
  return {
    nShared: n,
    meanHalfWidth: mean,
    minHalfWidth: minV,
    maxHalfWidth: maxV,
    sgini: g,
    nu: FIXED_NU,
    elasticity,
    gNuLow: gLow,
    gNuHigh: gHigh,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

export function buildSourceRowTokenSlopeCiLensWidthSGini(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthSGiniOptions = {},
): SourceRowTokenSlopeCiLensWidthSGiniReport {
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
  const alertSgini = opts.alertSgini ?? null;
  if (alertSgini !== null) {
    if (!Number.isFinite(alertSgini) || alertSgini < 0 || alertSgini > 1) {
      throw new Error(
        `alertSgini must be a finite number in [0, 1] (got ${opts.alertSgini})`,
      );
    }
  }
  const sort = opts.sort ?? 'sgini-desc';
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
    SlopeLensWidthSGiniLensName,
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
  for (const lens of SLOPE_LENS_WIDTH_SGINI_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_SGINI_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthSGiniLensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_SGINI_LENS_NAMES) {
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const halfW = (hi - lo) / 2;
      halfs.push(halfW);
    }
    const comp = lensWidthSGini(halfs);
    rows.push({
      lens,
      nShared: comp.nShared,
      meanHalfWidth: comp.meanHalfWidth,
      minHalfWidth: comp.minHalfWidth,
      maxHalfWidth: comp.maxHalfWidth,
      sgini: comp.sgini,
      nu: comp.nu,
      elasticity: comp.elasticity,
      gNuLow: comp.gNuLow,
      gNuHigh: comp.gNuHigh,
      concentrationLabel: classifyConcentration(comp.sgini, comp.degenerateFlag),
      degenerateFlag: comp.degenerateFlag,
      degenerateReason: comp.degenerateReason,
      perSourceHalfWidths: halfs,
      perSourceSources: [...sharedSources],
    });
  }

  const finite = rows.filter((r) => !r.degenerateFlag);
  const gs = finite.map((r) => r.sgini);
  const meanG = gs.length > 0 ? gs.reduce((a, b) => a + b, 0) / gs.length : 0;
  const medianG = median(gs);
  const maxG = gs.length > 0 ? Math.max(...gs) : 0;
  const minG = gs.length > 0 ? Math.min(...gs) : 0;
  const rangeG = gs.length > 0 ? maxG - minG : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nExtreme = rows.filter(
    (r) => r.concentrationLabel === 'extreme',
  ).length;
  const nNearUniform = rows.filter(
    (r) => r.concentrationLabel === 'near-uniform',
  ).length;

  let mostExtremeLens: SlopeLensWidthSGiniLensName | null = null;
  let mostUniformLens: SlopeLensWidthSGiniLensName | null = null;
  if (finite.length > 0) {
    let bestHi = -Infinity;
    let bestLo = Infinity;
    for (const r of finite) {
      if (r.sgini > bestHi) {
        bestHi = r.sgini;
        mostExtremeLens = r.lens;
      }
      if (r.sgini < bestLo) {
        bestLo = r.sgini;
        mostUniformLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertSgini !== null) {
    filtered = filtered.filter((r) => r.sgini > alertSgini);
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthSGiniLensRow,
      b: SourceRowTokenSlopeCiLensWidthSGiniLensRow,
    ) => number
  > = {
    'sgini-desc': (a, b) => b.sgini - a.sgini,
    'sgini-asc': (a, b) => a.sgini - b.sgini,
    'mean-halfwidth-desc': (a, b) => b.meanHalfWidth - a.meanHalfWidth,
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_SGINI_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_SGINI_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_SGINI_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_SGINI_LENS_NAMES.indexOf(b.lens)
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
    alertSgini,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    nu: FIXED_NU,
    meanG,
    medianG,
    maxG,
    minG,
    rangeG,
    nDegenerate,
    nExtreme,
    nNearUniform,
    mostExtremeLens,
    mostUniformLens,
    rows: filtered,
  };
}

/**
 * Refinement helper: lensWidthSGiniNuSweep.
 *
 * Evaluates G(nu) at a user-supplied vector of nu values
 * (typically nu = 2, 2.5, 3, 4, 6 for a five-point sensitivity
 * sweep). Returns null on degenerate input. Otherwise returns
 * an array of { nu, g } pairs.
 *
 * Distinct from axis-30's lensWidthMehranKernelSweep which
 * varies the kernel EXPONENT alpha in (1-p)^alpha against the
 * Lorenz gap with a NORMALISATION (alpha+1)(alpha+2). The S-Gini
 * sweep varies the rank-aversion parameter nu directly with the
 * canonical S-Gini normalisation nu*(nu-1) and recovers the
 * classical Gini at nu = 2 (where alpha = 0 in the Mehran sweep
 * also recovers Gini -- they are the same function at that
 * single point but differ everywhere else).
 */
export function lensWidthSGiniNuSweep(
  halfWidths: number[],
  nus: number[],
): { nu: number; g: number }[] | null {
  if (nus.length === 0) return [];
  for (const v of nus) {
    if (!Number.isFinite(v) || v <= 1) {
      throw new Error(
        `lensWidthSGiniNuSweep: nus must be finite > 1 (got ${v})`,
      );
    }
  }
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthSGiniNuSweep: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthSGiniNuSweep: halfWidths must be non-negative (got ${v})`,
      );
    }
  }
  const n = halfWidths.length;
  if (n < MIN_SHARED_SOURCES) return null;
  let total = 0;
  for (const v of halfWidths) total += v;
  const mean = total / n;
  if (!(mean > 0) || !Number.isFinite(mean)) return null;
  const out: { nu: number; g: number }[] = [];
  for (const nu of nus) {
    out.push({ nu, g: lensWidthSGiniAtNu(halfWidths, nu)! });
  }
  return out;
}

function fmtNum(x: number, digits = 4): string {
  if (!Number.isFinite(x)) {
    return x === Infinity ? 'inf' : x === -Infinity ? '-inf' : 'NaN';
  }
  return x.toFixed(digits);
}

export function renderSourceRowTokenSlopeCiLensWidthSGini(
  r: SourceRowTokenSlopeCiLensWidthSGiniReport,
  opts: {
    showSummary?: boolean;
    showConcentrationAggregate?: boolean;
    showLensAttribution?: boolean;
    showElasticity?: boolean;
    showNuSweep?: boolean;
    showPerSourceWidths?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showConcentrationAggregate = opts.showConcentrationAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showElasticity = opts.showElasticity ?? false;
  const showNuSweep = opts.showNuSweep ?? false;
  const showPerSourceWidths = opts.showPerSourceWidths ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-width-sgini');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    nu: ${r.nu}    alert-sgini: ${r.alertSgini ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanG: ${fmtNum(r.meanG, 6)}; medianG: ${fmtNum(r.medianG, 6)}; maxG: ${fmtNum(r.maxG, 6)}; minG: ${fmtNum(r.minG, 6)}; rangeG: ${fmtNum(r.rangeG, 6)}; nExtreme: ${r.nExtreme}; nNearUniform: ${r.nNearUniform}; nDegen: ${r.nDegenerate}; mostExtreme: ${r.mostExtremeLens ?? '-'}; mostUniform: ${r.mostUniformLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     G(3)       mean       min        max        elasticity  concentration       reason',
  );
  lines.push(
    '-----------------  ----  ---------  ---------  ---------  ---------  ----------  ------------------  ---------------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        fmtNum(row.sgini, 6).padStart(9),
        fmtNum(row.meanHalfWidth, 6).padStart(9),
        fmtNum(row.minHalfWidth, 6).padStart(9),
        fmtNum(row.maxHalfWidth, 6).padStart(9),
        fmtNum(row.elasticity, 6).padStart(10),
        row.concentrationLabel.padEnd(18),
        (row.degenerateReason ?? '-').padEnd(21),
      ].join('  '),
    );
    if (showSummary) {
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} G(3)=${fmtNum(row.sgini, 6)} mean=${fmtNum(row.meanHalfWidth, 6)} concentration=${row.concentrationLabel}`,
      );
    }
    if (showElasticity) {
      lines.push(
        `    elasticity: G(${FIXED_NU - ELASTICITY_H})=${fmtNum(row.gNuLow, 6)} G(${FIXED_NU})=${fmtNum(row.sgini, 6)} G(${FIXED_NU + ELASTICITY_H})=${fmtNum(row.gNuHigh, 6)} dlnG/dlnNu=${fmtNum(row.elasticity, 6)} (local rank-aversion sensitivity at nu=${FIXED_NU})`,
      );
    }
    if (showNuSweep) {
      if (row.degenerateFlag) {
        lines.push(`    nuSweep: (degenerate)`);
      } else {
        const sweep = lensWidthSGiniNuSweep(
          row.perSourceHalfWidths,
          [2, 2.5, 3, 4, 6],
        );
        if (sweep === null) {
          lines.push(`    nuSweep: (degenerate)`);
        } else {
          const parts = sweep.map(
            (s) => `G(${fmtNum(s.nu, 1)})=${fmtNum(s.g, 6)}`,
          );
          lines.push(
            `    nuSweep: ${parts.join(' ')} (nu=2 -> Gini; nu=3 -> Mehran/S-Gini@3; larger nu -> bottom-tail-emphasising)`,
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
      `[concentration aggregate] nExtreme=${r.nExtreme}/${denom} (${fmtNum(r.nExtreme / denom, 4)}) nNearUniform=${r.nNearUniform}/${denom} (${fmtNum(r.nNearUniform / denom, 4)}) nDegen=${r.nDegenerate}/${denom} (${fmtNum(r.nDegenerate / denom, 4)}) meanG=${fmtNum(r.meanG, 6)} medianG=${fmtNum(r.medianG, 6)} rangeG=${fmtNum(r.rangeG, 6)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostExtreme=${r.mostExtremeLens ?? '-'} (max G(3)) mostUniform=${r.mostUniformLens ?? '-'} (min G(3))`,
    );
  }
  return lines.join('\n');
}
