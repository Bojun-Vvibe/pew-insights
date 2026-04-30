/**
 * source-row-token-slope-ci-lens-width-palma
 *
 * Per-lens CROSS-SOURCE PALMA RATIO (S90/S40) of CI half-widths
 * (TWENTY-SIXTH cross-lens axis) for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six per-source
 * slope CIs as v0.6.227-v0.6.254 (percentile bootstrap, jackknife
 * normal, BCa, studentized-t, ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL TWENTY-FIVE prior cross-lens
 * diagnostics on multiple orthogonal dimensions:
 *
 *   1. STATISTIC FAMILY. Palma (Cobham-Sumner-Palma 2011, 2013) is a
 *      RATIO OF TWO DISJOINT TAIL SHARES of the Lorenz curve:
 *
 *        Palma = (1 - L(0.9)) / L(0.4)
 *              = topDecileMassShare / bottomFourDecilesMassShare
 *
 *      It is NEITHER an integral functional (axis-21 Gini), NOR an
 *      L_infinity functional (axis-25 Hoover), NOR an entropic
 *      functional (axis-22 Theil), NOR a CRRA welfare loss
 *      (axis-23 Atkinson), NOR a single-quartile spread
 *      (axis-24 QCD). It is a TWO-POINT EVALUATION of the Lorenz
 *      curve at p = 0.4 and p = 0.9 combined as a RATIO. The
 *      distinction is fundamental:
 *        - axes 21, 25 collapse the WHOLE Lorenz process to one
 *          scalar (area / sup respectively).
 *        - axes 22, 23 are GLOBAL functionals of all values.
 *        - axis-24 QCD uses TWO QUANTILES of the VALUE distribution
 *          (Q1, Q3); Palma uses TWO QUANTILES of the CUMULATIVE-MASS
 *          distribution (the Lorenz process at p=0.4, p=0.9).
 *      Palma is therefore the only cross-lens diagnostic shipped
 *      that is unbounded above (Palma in [0, +inf)) and the only
 *      one whose primary economic interpretation is a STRATIFIED
 *      TAIL COMPARISON ("how many times richer the top 10% is than
 *      the bottom 40% combined").
 *
 *   2. SCALE-FAMILY. Palma is scale-invariant (numerator and
 *      denominator are both shares of S = sum). Like Gini/Hoover
 *      it ignores the level of the half-widths -- but UNLIKE
 *      Gini/Hoover it is sensitive to the MIDDLE 50% only through
 *      the mass conservation identity (the 40th-90th percentile
 *      band is treated as a SINGLE residual). The Palma hypothesis
 *      (Cobham-Sumner 2013) is that the middle band's share is
 *      empirically near-constant, so all the inequality information
 *      lives in the two tails. This is the OPPOSITE sensitivity
 *      profile of Gini/Theil/Atkinson, which all weight the middle
 *      heavily.
 *
 *   3. SENSITIVITY PROFILE. Palma satisfies the Pigou-Dalton
 *      transfer principle ONLY when the transfer crosses one of the
 *      decile boundaries p = 0.4 or p = 0.9. Mean-preserving
 *      transfers ENTIRELY WITHIN the bottom 40%, ENTIRELY WITHIN
 *      the middle 50%, or ENTIRELY WITHIN the top 10% leave Palma
 *      UNCHANGED. This is a DIFFERENT insensitivity from Hoover
 *      (which is insensitive to transfers on the same side of the
 *      mean, not on the same side of the deciles).
 *
 *   4. UNBOUNDEDNESS. Palma is unbounded above (Palma in [0, +inf)).
 *      All prior cross-lens axes are bounded:
 *        - Gini, Hoover in [0, 1 - 1/n]
 *        - Theil GE(1) in [0, log n]
 *        - Atkinson in [0, 1]
 *        - QCD in [0, 1]
 *      An unbounded measure has fundamentally different
 *      tail-saturation behaviour: Palma is the only axis that can
 *      diverge to +infinity as the bottom-40% mass goes to zero
 *      while the top-10% mass stays bounded.
 *
 *   5. LORENZ-INTERPOLATION. With n typically small (4-12), the
 *      Lorenz curve is evaluated by piecewise-linear interpolation
 *      between the n+1 anchor points (0, 0), (1/n, c_1), ...,
 *      (k/n, c_k), ..., (1, 1) where c_k is the cumulative share of
 *      the k smallest sorted half-widths. L(p) is then read off at
 *      p = 0.4 and p = 0.9. This is the canonical Palma definition
 *      for ungrouped data and gives an EXACT scale-invariant
 *      tail-share ratio that does NOT require n to be a multiple
 *      of 10.
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.254. For each lens L:
 *
 *   For each source s in S (sources present in ALL six lens
 *   reports):
 *     halfWidth_{L,s} = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *
 *   Let w_(1) <= w_(2) <= ... <= w_(n) be the sorted cross-source
 *   half-widths and S = sum(w_i) > 0. Define the discrete Lorenz
 *   anchors (k/n, c_k) with c_k = sum_{i<=k} w_(i) / S, c_0 = 0,
 *   c_n = 1. L(p) is linear in between.
 *
 *     S40 = L(0.4)             -- bottom-four-deciles mass share
 *     S90 = 1 - L(0.9)         -- top-decile mass share
 *     Palma = S90 / S40
 *
 *   Edge cases:
 *     - n < 4 (parity with axes 21-25): Palma = 0, degenerateFlag =
 *       true, reason = 'too-few-sources'.
 *     - S = 0 (every half-width is exactly zero): Palma = 0,
 *       degenerateFlag = true, reason = 'zero-mass'.
 *     - S40 = 0 with S90 > 0 (the entire bottom 40% is zero, but
 *       there is mass in the upper bands): Palma = +Infinity,
 *       degenerateFlag = true, reason = 'zero-bottom-mass'. The
 *       reported numeric `palma` is clamped to a finite sentinel
 *       (`palmaSentinel`, default 1e12) and `palmaIsInfinite` is
 *       set to true.
 *     - Any half-width is negative or non-finite: throws.
 *
 * Per-lens columns:
 *   - `lens`              -- canonical lens name
 *   - `nShared`           -- number of shared sources used
 *   - `meanHalfWidth`     -- arithmetic mean of half-widths
 *   - `totalHalfWidth`    -- sum of half-widths
 *   - `s40`               -- bottom-40% mass share L(0.4) in [0, 1]
 *   - `s90`               -- top-10%   mass share 1 - L(0.9) in [0, 1]
 *   - `s50middle`         -- middle-50% residual share = 1 - s40 - s90
 *                            (Palma-hypothesis "constant middle")
 *   - `palmaHypothesisDistance` -- |s50middle - 0.5|, the absolute
 *                            distance from the Cobham-Sumner-Palma
 *                            (2013) empirical-constant-middle
 *                            target of 0.5. Smaller is better
 *                            agreement with the Palma hypothesis.
 *                            Reported as 0.5 (the worst possible
 *                            value for a valid distribution) when
 *                            degenerate.
 *   - `palma`             -- Palma ratio S90/S40 in [0, +inf)
 *                            (clamped to `palmaSentinel` when S40 = 0)
 *   - `palmaIsInfinite`   -- true iff S40 = 0 and S90 > 0
 *   - `concentrationLabel` -- qualitative bin on `palma`:
 *                            'extreme'        (palmaIsInfinite or palma > 4)
 *                            'high'           (palma in (2, 4])
 *                            'moderate'       (palma in (1, 2])
 *                            'balanced'       (palma in (0.5, 1])
 *                            'inverted'       (palma in [0, 0.5])
 *                            'degenerate'     (degenerateFlag without zero-bottom-mass)
 *   - `degenerateFlag`    -- true iff hit an edge case
 *   - `degenerateReason`  -- reason string, or null
 *
 * Report-level:
 *   - meanPalma           -- mean of finite, non-degenerate Palma values
 *   - medianPalma         -- median of finite, non-degenerate Palma values
 *   - maxPalma, minPalma, rangePalma (all over finite, non-degenerate)
 *   - nDegenerate         -- # lenses with degenerateFlag
 *   - nExtreme            -- # lenses with concentrationLabel = 'extreme'
 *   - nBalancedOrInverted -- # lenses with concentrationLabel in {'balanced','inverted'}
 *   - mostExtremeLens     -- argmax_L Palma over finite + 'extreme' last
 *   - mostBalancedLens    -- argmin_{L: Palma > 0} |Palma - 1|
 *
 * Filters:
 *   - --alert-palma <f>   -- keep lenses with palma > f (f >= 0)
 *   - --alert-mass <f>    -- keep lenses with totalHalfWidth > f
 *   - --alert-bottom-share <f> -- keep lenses with s40 < f (f in [0,1])
 *   - --alert-hypothesis-distance <f> -- keep lenses with
 *                            palmaHypothesisDistance > f
 *                            (f in [0, 0.5]); surfaces lenses
 *                            whose middle-50% share deviates most
 *                            from the canonical Palma target.
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_PALMA_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthPalmaLensName =
  (typeof SLOPE_LENS_WIDTH_PALMA_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 4;
const PALMA_SENTINEL = 1e12;

const EXTREME_THRESHOLD = 4;
const HIGH_THRESHOLD = 2;
const MODERATE_THRESHOLD = 1;
const BALANCED_THRESHOLD = 0.5;

export type PalmaDegenerateReason =
  | 'too-few-sources'
  | 'zero-mass'
  | 'zero-bottom-mass'
  | 'non-finite';

export type PalmaConcentrationLabel =
  | 'extreme'
  | 'high'
  | 'moderate'
  | 'balanced'
  | 'inverted'
  | 'degenerate';

export interface SourceRowTokenSlopeCiLensWidthPalmaOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertPalma?: number | null;
  alertMass?: number | null;
  alertBottomShare?: number | null;
  alertHypothesisDistance?: number | null;
  sort?:
    | 'palma-desc'
    | 'palma-asc'
    | 'mass-desc'
    | 'mean-halfwidth-desc'
    | 's40-asc'
    | 's90-desc'
    | 'hypothesis-distance-desc'
    | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthPalmaLensRow {
  lens: SlopeLensWidthPalmaLensName;
  nShared: number;
  meanHalfWidth: number;
  totalHalfWidth: number;
  s40: number;
  s90: number;
  s50middle: number;
  palmaHypothesisDistance: number;
  palma: number;
  palmaIsInfinite: boolean;
  concentrationLabel: PalmaConcentrationLabel;
  degenerateFlag: boolean;
  degenerateReason: PalmaDegenerateReason | null;
  perSourceHalfWidths: number[];
  perSourceSources: string[];
}

export interface SourceRowTokenSlopeCiLensWidthPalmaReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertPalma: number | null;
  alertMass: number | null;
  alertBottomShare: number | null;
  alertHypothesisDistance: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiLensWidthPalmaOptions['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  meanPalma: number;
  medianPalma: number;
  maxPalma: number;
  minPalma: number;
  rangePalma: number;
  nDegenerate: number;
  nExtreme: number;
  nBalancedOrInverted: number;
  mostExtremeLens: SlopeLensWidthPalmaLensName | null;
  mostBalancedLens: SlopeLensWidthPalmaLensName | null;
  rows: SourceRowTokenSlopeCiLensWidthPalmaLensRow[];
}

const VALID_SORTS = [
  'palma-desc',
  'palma-asc',
  'mass-desc',
  'mean-halfwidth-desc',
  's40-asc',
  's90-desc',
  'hypothesis-distance-desc',
  'lens',
] as const;

const PALMA_HYPOTHESIS_TARGET = 0.5;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[m]!;
  return (s[m - 1]! + s[m]!) / 2;
}

function classifyPalma(
  palma: number,
  palmaIsInfinite: boolean,
  degenerate: boolean,
  reason: PalmaDegenerateReason | null,
): PalmaConcentrationLabel {
  if (palmaIsInfinite) return 'extreme';
  if (degenerate && reason !== 'zero-bottom-mass') return 'degenerate';
  if (palma > EXTREME_THRESHOLD) return 'extreme';
  if (palma > HIGH_THRESHOLD) return 'high';
  if (palma > MODERATE_THRESHOLD) return 'moderate';
  if (palma > BALANCED_THRESHOLD) return 'balanced';
  return 'inverted';
}

/**
 * Evaluate the discrete Lorenz curve L(p) at p in [0, 1] for an
 * already-SORTED-ASCENDING non-negative half-width vector with
 * positive total. Uses piecewise-linear interpolation between the
 * n+1 anchor points (k/n, c_k) where c_k = sum_{i<=k} w_(i) / S.
 *
 * Exposed for direct unit-testing.
 */
export function lorenzAt(
  sortedHalfWidths: number[],
  total: number,
  p: number,
): number {
  const n = sortedHalfWidths.length;
  if (n === 0 || !(total > 0)) return 0;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  // anchor positions: 0, 1/n, 2/n, ..., 1
  const x = p * n; // continuous index in [0, n]
  const kLo = Math.floor(x);
  const kHi = Math.min(n, kLo + 1);
  const frac = x - kLo;
  // c_k = cumulative share of first k values
  let cLo = 0;
  for (let i = 0; i < kLo; i++) cLo += sortedHalfWidths[i]!;
  cLo /= total;
  if (kHi === kLo) return cLo;
  let cHi = cLo + sortedHalfWidths[kLo]! / total;
  if (cHi > 1) cHi = 1;
  return cLo + frac * (cHi - cLo);
}

/**
 * Compute the PALMA ratio S90/S40 on a single set of non-negative
 * half-widths.
 *
 *     S40 = L(0.4)      -- bottom-40% mass share
 *     S90 = 1 - L(0.9)  -- top-10%   mass share
 *     Palma = S90 / S40
 *
 * Returns degenerate metadata for the standard edge cases.
 *
 * Exposed for direct unit-testing.
 */
export function lensWidthPalma(halfWidths: number[]): {
  nShared: number;
  meanHalfWidth: number;
  totalHalfWidth: number;
  s40: number;
  s90: number;
  s50middle: number;
  palma: number;
  palmaIsInfinite: boolean;
  degenerateFlag: boolean;
  degenerateReason: PalmaDegenerateReason | null;
} {
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthPalma: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthPalma: halfWidths must be non-negative (got ${v})`,
      );
    }
  }
  const n = halfWidths.length;
  if (n < MIN_SHARED_SOURCES) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      totalHalfWidth: 0,
      s40: 0,
      s90: 0,
      s50middle: 0,
      palma: 0,
      palmaIsInfinite: false,
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
      s40: 0,
      s90: 0,
      s50middle: 0,
      palma: 0,
      palmaIsInfinite: false,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  if (total === 0) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      totalHalfWidth: 0,
      s40: 0,
      s90: 0,
      s50middle: 0,
      palma: 0,
      palmaIsInfinite: false,
      degenerateFlag: true,
      degenerateReason: 'zero-mass',
    };
  }
  const mean = total / n;
  const sorted = [...halfWidths].sort((a, b) => a - b);
  const l40 = lorenzAt(sorted, total, 0.4);
  const l90 = lorenzAt(sorted, total, 0.9);
  let s40 = l40;
  let s90 = 1 - l90;
  if (s40 < 0) s40 = 0;
  if (s40 > 1) s40 = 1;
  if (s90 < 0) s90 = 0;
  if (s90 > 1) s90 = 1;
  const s50middle = Math.max(0, 1 - s40 - s90);
  if (s40 === 0) {
    if (s90 > 0) {
      return {
        nShared: n,
        meanHalfWidth: mean,
        totalHalfWidth: total,
        s40,
        s90,
        s50middle,
        palma: PALMA_SENTINEL,
        palmaIsInfinite: true,
        degenerateFlag: true,
        degenerateReason: 'zero-bottom-mass',
      };
    }
    return {
      nShared: n,
      meanHalfWidth: mean,
      totalHalfWidth: total,
      s40,
      s90,
      s50middle,
      palma: 0,
      palmaIsInfinite: false,
      degenerateFlag: true,
      degenerateReason: 'zero-bottom-mass',
    };
  }
  let palma = s90 / s40;
  if (!Number.isFinite(palma)) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      totalHalfWidth: total,
      s40,
      s90,
      s50middle,
      palma: PALMA_SENTINEL,
      palmaIsInfinite: true,
      degenerateFlag: true,
      degenerateReason: 'non-finite',
    };
  }
  if (palma < 0) palma = 0;
  return {
    nShared: n,
    meanHalfWidth: mean,
    totalHalfWidth: total,
    s40,
    s90,
    s50middle,
    palma,
    palmaIsInfinite: false,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

export function buildSourceRowTokenSlopeCiLensWidthPalma(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthPalmaOptions = {},
): SourceRowTokenSlopeCiLensWidthPalmaReport {
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
  const alertPalma = opts.alertPalma ?? null;
  if (alertPalma !== null) {
    if (!Number.isFinite(alertPalma) || alertPalma < 0) {
      throw new Error(
        `alertPalma must be a finite, non-negative number (got ${opts.alertPalma})`,
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
  const alertBottomShare = opts.alertBottomShare ?? null;
  if (alertBottomShare !== null) {
    if (
      !Number.isFinite(alertBottomShare) ||
      alertBottomShare < 0 ||
      alertBottomShare > 1
    ) {
      throw new Error(
        `alertBottomShare must be a finite number in [0, 1] (got ${opts.alertBottomShare})`,
      );
    }
  }
  const alertHypothesisDistance = opts.alertHypothesisDistance ?? null;
  if (alertHypothesisDistance !== null) {
    if (
      !Number.isFinite(alertHypothesisDistance) ||
      alertHypothesisDistance < 0 ||
      alertHypothesisDistance > 0.5
    ) {
      throw new Error(
        `alertHypothesisDistance must be a finite number in [0, 0.5] (got ${opts.alertHypothesisDistance})`,
      );
    }
  }
  const sort = opts.sort ?? 'palma-desc';
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
    SlopeLensWidthPalmaLensName,
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
  for (const lens of SLOPE_LENS_WIDTH_PALMA_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_PALMA_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthPalmaLensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_PALMA_LENS_NAMES) {
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const halfW = (hi - lo) / 2;
      halfs.push(halfW);
    }
    const comp = lensWidthPalma(halfs);
    const concentrationLabel = classifyPalma(
      comp.palma,
      comp.palmaIsInfinite,
      comp.degenerateFlag,
      comp.degenerateReason,
    );
    rows.push({
      lens,
      nShared: comp.nShared,
      meanHalfWidth: comp.meanHalfWidth,
      totalHalfWidth: comp.totalHalfWidth,
      s40: comp.s40,
      s90: comp.s90,
      s50middle: comp.s50middle,
      palmaHypothesisDistance: comp.degenerateFlag
        ? PALMA_HYPOTHESIS_TARGET
        : Math.abs(comp.s50middle - PALMA_HYPOTHESIS_TARGET),
      palma: comp.palma,
      palmaIsInfinite: comp.palmaIsInfinite,
      concentrationLabel,
      degenerateFlag: comp.degenerateFlag,
      degenerateReason: comp.degenerateReason,
      perSourceHalfWidths: halfs,
      perSourceSources: [...sharedSources],
    });
  }

  // Aggregates over FINITE non-degenerate Palma values only.
  const finiteRows = rows.filter(
    (r) => !r.degenerateFlag && !r.palmaIsInfinite,
  );
  const ps = finiteRows.map((r) => r.palma);
  const meanPalma =
    ps.length > 0 ? ps.reduce((a, b) => a + b, 0) / ps.length : 0;
  const medianPalma = median(ps);
  const maxPalma = ps.length > 0 ? Math.max(...ps) : 0;
  const minPalma = ps.length > 0 ? Math.min(...ps) : 0;
  const rangePalma = ps.length > 0 ? maxPalma - minPalma : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nExtreme = rows.filter(
    (r) => r.concentrationLabel === 'extreme',
  ).length;
  const nBalancedOrInverted = rows.filter(
    (r) =>
      r.concentrationLabel === 'balanced' ||
      r.concentrationLabel === 'inverted',
  ).length;

  let mostExtremeLens: SlopeLensWidthPalmaLensName | null = null;
  let mostBalancedLens: SlopeLensWidthPalmaLensName | null = null;
  // Most extreme: any palmaIsInfinite first (canonical lens order tie-break),
  // else argmax over finite non-degenerate.
  const infRows = rows.filter((r) => r.palmaIsInfinite);
  if (infRows.length > 0) {
    mostExtremeLens = infRows[0]!.lens;
  } else if (finiteRows.length > 0) {
    let best = -Infinity;
    for (const r of finiteRows) {
      if (r.palma > best) {
        best = r.palma;
        mostExtremeLens = r.lens;
      }
    }
  }
  if (finiteRows.length > 0) {
    let bestDist = Infinity;
    for (const r of finiteRows) {
      const d = Math.abs(r.palma - 1);
      if (d < bestDist) {
        bestDist = d;
        mostBalancedLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertPalma !== null) {
    filtered = filtered.filter(
      (r) => !r.degenerateFlag && r.palma > alertPalma!,
    );
  }
  if (alertMass !== null) {
    filtered = filtered.filter((r) => r.totalHalfWidth > alertMass!);
  }
  if (alertBottomShare !== null) {
    filtered = filtered.filter(
      (r) => !r.degenerateFlag && r.s40 < alertBottomShare!,
    );
  }
  if (alertHypothesisDistance !== null) {
    filtered = filtered.filter(
      (r) =>
        !r.degenerateFlag &&
        r.palmaHypothesisDistance > alertHypothesisDistance!,
    );
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthPalmaLensRow,
      b: SourceRowTokenSlopeCiLensWidthPalmaLensRow,
    ) => number
  > = {
    'palma-desc': (a, b) => {
      // Infinite rows go first.
      if (a.palmaIsInfinite && !b.palmaIsInfinite) return -1;
      if (!a.palmaIsInfinite && b.palmaIsInfinite) return 1;
      // Degenerate (non-infinite) rows demoted to bottom.
      const sa =
        a.degenerateFlag && !a.palmaIsInfinite ? -Infinity : a.palma;
      const sb =
        b.degenerateFlag && !b.palmaIsInfinite ? -Infinity : b.palma;
      return sb - sa;
    },
    'palma-asc': (a, b) => {
      const sa =
        a.degenerateFlag && !a.palmaIsInfinite ? Infinity : a.palma;
      const sb =
        b.degenerateFlag && !b.palmaIsInfinite ? Infinity : b.palma;
      return sa - sb;
    },
    'mass-desc': (a, b) => b.totalHalfWidth - a.totalHalfWidth,
    'mean-halfwidth-desc': (a, b) => b.meanHalfWidth - a.meanHalfWidth,
    's40-asc': (a, b) => {
      const sa = a.degenerateFlag ? Infinity : a.s40;
      const sb = b.degenerateFlag ? Infinity : b.s40;
      return sa - sb;
    },
    's90-desc': (a, b) => {
      const sa = a.degenerateFlag ? -Infinity : a.s90;
      const sb = b.degenerateFlag ? -Infinity : b.s90;
      return sb - sa;
    },
    'hypothesis-distance-desc': (a, b) => {
      const sa = a.degenerateFlag ? -Infinity : a.palmaHypothesisDistance;
      const sb = b.degenerateFlag ? -Infinity : b.palmaHypothesisDistance;
      return sb - sa;
    },
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_PALMA_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_PALMA_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_PALMA_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_PALMA_LENS_NAMES.indexOf(b.lens)
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
    alertPalma,
    alertMass,
    alertBottomShare,
    alertHypothesisDistance,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    meanPalma,
    medianPalma,
    maxPalma,
    minPalma,
    rangePalma,
    nDegenerate,
    nExtreme,
    nBalancedOrInverted,
    mostExtremeLens,
    mostBalancedLens,
    rows: filtered,
  };
}

function fmtNum(x: number, digits = 4): string {
  if (!Number.isFinite(x)) {
    return x === Infinity ? 'inf' : x === -Infinity ? '-inf' : 'NaN';
  }
  return x.toFixed(digits);
}

function fmtPalma(x: number, isInf: boolean, digits = 4): string {
  if (isInf) return 'inf';
  return fmtNum(x, digits);
}

export function renderSourceRowTokenSlopeCiLensWidthPalma(
  r: SourceRowTokenSlopeCiLensWidthPalmaReport,
  opts: {
    showSummary?: boolean;
    showConcentrationAggregate?: boolean;
    showLensAttribution?: boolean;
    showTailDecomposition?: boolean;
    showPalmaHypothesis?: boolean;
    showPerSourceWidths?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showConcentrationAggregate = opts.showConcentrationAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showTailDecomposition = opts.showTailDecomposition ?? false;
  const showPalmaHypothesis = opts.showPalmaHypothesis ?? false;
  const showPerSourceWidths = opts.showPerSourceWidths ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-width-palma');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-palma: ${r.alertPalma ?? '-'}    alert-mass: ${r.alertMass ?? '-'}    alert-bottom-share: ${r.alertBottomShare ?? '-'}    alert-hypothesis-distance: ${r.alertHypothesisDistance ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanPalma: ${fmtNum(r.meanPalma)}; medianPalma: ${fmtNum(r.medianPalma)}; maxPalma: ${fmtNum(r.maxPalma)}; minPalma: ${fmtNum(r.minPalma)}; rangePalma: ${fmtNum(r.rangePalma)}; nExtreme: ${r.nExtreme}; nBalancedOrInverted: ${r.nBalancedOrInverted}; nDegen: ${r.nDegenerate}; mostExtreme: ${r.mostExtremeLens ?? '-'}; mostBalanced: ${r.mostBalancedLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     palma     S40      S90      mean       total      concentration  reason',
  );
  lines.push(
    '-----------------  ----  --------  -------  -------  ---------  ---------  -------------  ---------------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        fmtPalma(row.palma, row.palmaIsInfinite).padStart(8),
        fmtNum(row.s40).padStart(7),
        fmtNum(row.s90).padStart(7),
        fmtNum(row.meanHalfWidth, 6).padStart(9),
        fmtNum(row.totalHalfWidth, 6).padStart(9),
        row.concentrationLabel.padEnd(13),
        (row.degenerateReason ?? '-').padEnd(21),
      ].join('  '),
    );
    if (showSummary) {
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} palma=${fmtPalma(row.palma, row.palmaIsInfinite)} S40=${fmtNum(row.s40)} S90=${fmtNum(row.s90)} concentration=${row.concentrationLabel}`,
      );
    }
    if (showTailDecomposition) {
      lines.push(
        `    tails: bottom-40%=${fmtNum(row.s40)} middle-50%=${fmtNum(row.s50middle)} top-10%=${fmtNum(row.s90)} (sum=${fmtNum(row.s40 + row.s50middle + row.s90)}); palma=S90/S40=${fmtPalma(row.palma, row.palmaIsInfinite)}`,
      );
    }
    if (showPalmaHypothesis) {
      if (row.degenerateFlag) {
        lines.push(`    hypothesis: (degenerate)`);
      } else {
        lines.push(
          `    hypothesis: middle-50%=${fmtNum(row.s50middle)} target=0.5000 distance=${fmtNum(row.palmaHypothesisDistance)} (Cobham-Sumner-Palma 2013 empirical-constant-middle target)`,
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
      `[concentration aggregate] nExtreme=${r.nExtreme}/${denom} (${fmtNum(r.nExtreme / denom, 4)}) nBalancedOrInverted=${r.nBalancedOrInverted}/${denom} (${fmtNum(r.nBalancedOrInverted / denom, 4)}) nDegen=${r.nDegenerate}/${denom} (${fmtNum(r.nDegenerate / denom, 4)}) meanPalma=${fmtNum(r.meanPalma)} medianPalma=${fmtNum(r.medianPalma)} rangePalma=${fmtNum(r.rangePalma)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostExtreme=${r.mostExtremeLens ?? '-'} (max Palma) mostBalanced=${r.mostBalancedLens ?? '-'} (Palma closest to 1)`,
    );
  }
  return lines.join('\n');
}
