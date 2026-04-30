/**
 * source-row-token-slope-ci-lens-width-wolfson
 *
 * Per-lens CROSS-SOURCE WOLFSON BIPOLARISATION INDEX of CI
 * half-widths (THIRTY-THIRD cross-lens axis) for the v0.6.219
 * Deming-slope uncertainty-quantification suite. Consumes the
 * SAME six per-source slope CIs as v0.6.227-v0.6.267 (percentile
 * bootstrap, jackknife normal, BCa, studentized-t, ABC,
 * profile-likelihood).
 *
 * Mechanically distinct from ALL THIRTY-TWO prior cross-lens
 * diagnostics on a fundamentally orthogonal axis:
 *
 *   1. STATISTIC FAMILY. The Wolfson bipolarisation index W is a
 *      MEDIAN-ANCHORED polarisation measure (Wolfson 1994, 1997)
 *      that quantifies how mass spreads AWAY FROM THE MEDIAN
 *      towards two distinct modes:
 *
 *        W = 2 * (2 * T - Gini) * (mean / median)
 *
 *      where
 *
 *        T     = 0.5 - L(0.5)
 *
 *      is the GAP between the equality line and the Lorenz curve
 *      AT THE MEDIAN POINT p = 0.5 (i.e. the income share above
 *      the median minus 0.5; equivalently 0.5 - cumShareAtMedian),
 *      and Gini is the standard Gini coefficient of the same
 *      half-widths. The (mean / median) factor rescales the index
 *      to dollars at the median.
 *
 *      Intuition. The standard Gini is the AREA under the Lorenz
 *      curve gap. Wolfson takes only the median POINT of that gap
 *      (T = 2 * spread half) and SUBTRACTS the average Lorenz gap
 *      (Gini / 2). The result is positive when mass is
 *      concentrated AT THE EXTREMES (bimodality / polarisation)
 *      and zero or negative when mass is concentrated NEAR the
 *      median. Two distributions with IDENTICAL Gini can have
 *      very different W: a distribution with most mass at one
 *      end will have a large Gini but small W (low polarisation,
 *      high inequality); a distribution with two modes far from
 *      the median will have a moderate Gini but a large W
 *      (high polarisation, moderate inequality).
 *
 *   2. ORTHOGONAL TO EVERY PRIOR AXIS. All thirty-two prior
 *      lens-width axes are MEAN-CENTERED inequality measures
 *      that score "spread of the whole distribution from
 *      equality":
 *
 *        - axis-21 Gini       : Lorenz-gap area integral
 *        - axis-22 Theil-T    : GE(1) entropy-weighted
 *        - axis-23 Atkinson   : welfare-loss CRRA
 *        - axis-24 QCD        : two-quartile point ratio
 *        - axis-25 Hoover     : L_inf Lorenz gap
 *        - axis-26 Palma      : top-decile / bottom-40% RATIO
 *        - axis-27 GE(2)      : top-tail squared-deviation
 *        - axis-28 Bonferroni : 1/p Lorenz-gap kernel
 *        - axis-29 Kolm-Pollak: translation-invariant exponential
 *        - axis-30 Mehran     : (1-p) Lorenz-gap kernel
 *        - axis-31 S-Gini     : (1-p)^(nu-2) Lorenz-gap kernel
 *        - axis-32 MLD = GE(0): bottom-tail log-scale gap
 *
 *      None of them is anchored at the MEDIAN or scores
 *      BIMODALITY. Two of them touch p = 0.5 incidentally:
 *      axis-26 Palma uses the bottom 40% (NOT the median), and
 *      axis-25 Hoover is the L_inf of the gap (which can occur
 *      anywhere). Wolfson is the unique member of the suite for
 *      which:
 *
 *        - a UNIMODAL distribution centered at the median yields
 *          W approximately = 0 even with high variance;
 *        - a BIMODAL distribution with modes far from the median
 *          yields a LARGE W even when Gini is moderate.
 *
 *      Concretely: the input [1,1,1,1,9,9,9,9] (perfectly
 *      bimodal around median 5) gives a much larger W per-unit-Gini
 *      ratio than [1,2,3,4,5,6,7,80] (unimodal with one outlier),
 *      and the two have COMPARABLE Ginis.
 *
 *   3. ANALYTIC IDENTITIES the axis can verify on the fly:
 *
 *        a. ZERO IDENTITY. If all x_i are identical, then
 *           Gini = 0, T = 0, W = 0. We test this exactly.
 *
 *        b. SIGN. By construction W >= 0 only when 2*T >= Gini.
 *           Since T = 0.5 - L(0.5) and the Lorenz curve is
 *           convex with L(0.5) <= 0.5, we have T in [0, 0.5].
 *           For Gini in [0, 1], W can be NEGATIVE if the
 *           distribution is heavily ONE-SIDED (most mass below
 *           the median or one extreme outlier). We surface a
 *           `polarisationSignLabel` to flag the sign regime.
 *
 *        c. SCALE INVARIANCE. W is invariant under uniform
 *           scaling x -> c*x for c > 0 (mean and median both
 *           scale by c, ratio unchanged; Gini scale-invariant;
 *           T scale-invariant).
 *
 *        d. TRANSLATION DEPENDENCE. Adding a constant SHIFTS
 *           both mean and median equally but reduces Gini and
 *           T (the relative spread shrinks), so W -> 0 as the
 *           translation grows. Verified.
 *
 * Definition. Let the six lenses be canonically ordered as in
 * v0.6.227-v0.6.267. For each lens L:
 *
 *   For each source s in the SHARED set (sources present in ALL
 *   six lens reports):
 *     halfWidth_{L,s} = (ciUpper_{L,s} - ciLower_{L,s}) / 2
 *
 *   Sort the half-widths ascending: x_(1) <= x_(2) <= ... <= x_(n).
 *   Let mean = (1/n) * sum x_i; median = empirical median.
 *   Standard Gini:
 *     Gini = (2 * sum_{i=1..n} i * x_(i)) / (n * sum x_(i)) - (n + 1) / n
 *   Lorenz curve at p = 0.5: linear interpolation of the empirical
 *     Lorenz polygon evaluated at p = 0.5.
 *   T = 0.5 - L(0.5).
 *   W = 2 * (2 * T - Gini) * (mean / median).
 *
 *   Edge cases (parity with axes 21-32):
 *     - n < 4: W = 0, degenerateFlag = true,
 *              reason = 'too-few-sources'.
 *     - mean <= 0: W = 0, degenerateFlag = true,
 *              reason = 'zero-mean'.
 *     - median <= 0: W = 0, degenerateFlag = true,
 *              reason = 'zero-median'  (UNIQUE to Wolfson; needed
 *              because the (mean/median) scaling factor blows up
 *              when median = 0).
 *     - All half-widths identical: W = 0 exactly (NOT degenerate).
 *     - Any half-width is negative or non-finite: throws.
 *
 * Per-lens columns:
 *   - `lens`                    -- canonical lens name
 *   - `nShared`                 -- number of shared sources used
 *   - `meanHalfWidth`           -- arithmetic mean of half-widths
 *   - `medianHalfWidth`         -- empirical median
 *   - `gini`                    -- standard Gini for reference
 *   - `lorenzAtMedian`          -- L(0.5), the cumulative income
 *                                  share at p = 0.5
 *   - `t`                       -- 0.5 - L(0.5), the median spread
 *   - `wolfson`                 -- the Wolfson bipolarisation index
 *   - `meanOverMedian`          -- mean/median scaling factor
 *   - `polarisationSignLabel`   -- 'bipolarised' (W > 0) /
 *                                  'unipolarised' (W < 0) /
 *                                  'balanced' (|W| < 1e-9) /
 *                                  'degenerate'
 *   - `polarisationLabel`       -- qualitative bin on |W|:
 *                                  'extreme'           (>= 0.5)
 *                                  'high'              ([0.25, 0.5))
 *                                  'moderate'          ([0.1, 0.25))
 *                                  'mild'              ((0, 0.1))
 *                                  'near-zero'         (== 0)
 *                                  'degenerate'        (degenerateFlag)
 *   - `degenerateFlag`          -- true iff hit an edge case
 *   - `degenerateReason`        -- reason string, or null
 *
 * Report-level: meanW, medianW, maxW, minW, rangeW, nDegenerate,
 * nExtreme, nNearZero, nBipolarised, nUnipolarised,
 * mostBipolarisedLens (argmax W), mostUnipolarisedLens (argmin W).
 *
 * Filters:
 *   - --alert-wolfson <f>       -- keep lenses with |W| > f (f >= 0)
 *
 * Sorts: 'wolfson-desc' (default), 'wolfson-asc',
 *        'abs-wolfson-desc', 'mean-halfwidth-desc', 'lens'.
 */

import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_WIDTH_WOLFSON_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensWidthWolfsonLensName =
  (typeof SLOPE_LENS_WIDTH_WOLFSON_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const MIN_SHARED_SOURCES = 4;

const EXTREME_THRESHOLD = 0.5;
const HIGH_THRESHOLD = 0.25;
const MODERATE_THRESHOLD = 0.1;

export type WolfsonDegenerateReason =
  | 'too-few-sources'
  | 'zero-mean'
  | 'zero-median';

export type WolfsonPolarisationLabel =
  | 'extreme'
  | 'high'
  | 'moderate'
  | 'mild'
  | 'near-zero'
  | 'degenerate';

export type WolfsonPolarisationSignLabel =
  | 'bipolarised'
  | 'unipolarised'
  | 'balanced'
  | 'degenerate';

export interface SourceRowTokenSlopeCiLensWidthWolfsonOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertWolfson?: number | null;
  sort?:
    | 'wolfson-desc'
    | 'wolfson-asc'
    | 'abs-wolfson-desc'
    | 'mean-halfwidth-desc'
    | 'lens';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensWidthWolfsonLensRow {
  lens: SlopeLensWidthWolfsonLensName;
  nShared: number;
  meanHalfWidth: number;
  medianHalfWidth: number;
  gini: number;
  lorenzAtMedian: number;
  t: number;
  wolfson: number;
  meanOverMedian: number;
  polarisationSignLabel: WolfsonPolarisationSignLabel;
  polarisationLabel: WolfsonPolarisationLabel;
  degenerateFlag: boolean;
  degenerateReason: WolfsonDegenerateReason | null;
  perSourceHalfWidths: number[];
  perSourceSources: string[];
}

export interface SourceRowTokenSlopeCiLensWidthWolfsonReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertWolfson: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiLensWidthWolfsonOptions['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  meanW: number;
  medianW: number;
  maxW: number;
  minW: number;
  rangeW: number;
  nDegenerate: number;
  nExtreme: number;
  nNearZero: number;
  nBipolarised: number;
  nUnipolarised: number;
  mostBipolarisedLens: SlopeLensWidthWolfsonLensName | null;
  mostUnipolarisedLens: SlopeLensWidthWolfsonLensName | null;
  rows: SourceRowTokenSlopeCiLensWidthWolfsonLensRow[];
}

const VALID_SORTS = [
  'wolfson-desc',
  'wolfson-asc',
  'abs-wolfson-desc',
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

function classifyPolarisation(
  w: number,
  degenerate: boolean,
): WolfsonPolarisationLabel {
  if (degenerate) return 'degenerate';
  const a = Math.abs(w);
  if (!Number.isFinite(a) || a <= 0) return 'near-zero';
  if (a >= EXTREME_THRESHOLD) return 'extreme';
  if (a >= HIGH_THRESHOLD) return 'high';
  if (a >= MODERATE_THRESHOLD) return 'moderate';
  return 'mild';
}

function classifyPolarisationSign(
  w: number,
  degenerate: boolean,
): WolfsonPolarisationSignLabel {
  if (degenerate) return 'degenerate';
  if (Math.abs(w) < 1e-9) return 'balanced';
  if (w > 0) return 'bipolarised';
  return 'unipolarised';
}

/**
 * Standard Gini coefficient on a sorted positive-mean array.
 * Uses the closed-form sorted index identity:
 *   Gini = (2 * sum_{i=1..n} i * x_(i)) / (n * sum x_(i)) - (n + 1) / n
 */
function giniSorted(sorted: number[]): number {
  const n = sorted.length;
  let sum = 0;
  let weighted = 0;
  for (let i = 0; i < n; i++) {
    sum += sorted[i]!;
    weighted += (i + 1) * sorted[i]!;
  }
  if (sum <= 0) return 0;
  return (2 * weighted) / (n * sum) - (n + 1) / n;
}

/**
 * Lorenz curve at p = 0.5 -- the cumulative SHARE of the bottom
 * half of the distribution. Uses a linear-interpolation Lorenz
 * polygon at the median point.
 *
 * The Lorenz polygon vertices are (k/n, S_k / S_n) for
 * k = 0, 1, ..., n where S_k = sum of the bottom k order
 * statistics. We linearly interpolate at p = 0.5.
 */
function lorenzAtHalf(sorted: number[]): number {
  const n = sorted.length;
  let total = 0;
  for (const v of sorted) total += v;
  if (total <= 0) return 0.5;
  // Build cumulative-share vertices at p = k/n
  const target = 0.5;
  const kFloat = target * n;
  const kLow = Math.floor(kFloat);
  const kHigh = Math.ceil(kFloat);
  let cumLow = 0;
  for (let i = 0; i < kLow; i++) cumLow += sorted[i]!;
  if (kLow === kHigh) return cumLow / total;
  let cumHigh = cumLow + sorted[kLow]!;
  const shareLow = cumLow / total;
  const shareHigh = cumHigh / total;
  const pLow = kLow / n;
  const pHigh = kHigh / n;
  // Linear interp between (pLow, shareLow) and (pHigh, shareHigh)
  const frac = (target - pLow) / (pHigh - pLow);
  return shareLow + frac * (shareHigh - shareLow);
}

/**
 * Compute the WOLFSON BIPOLARISATION INDEX on a single set of
 * non-negative half-widths.
 *
 *   W = 2 * (2 * T - Gini) * (mean / median)
 *
 * where T = 0.5 - L(0.5).
 *
 * Returns degenerate metadata for too-few-sources, zero-mean,
 * and the Wolfson-unique zero-median case.
 *
 * Exposed for direct unit-testing.
 */
export function lensWidthWolfson(halfWidths: number[]): {
  nShared: number;
  meanHalfWidth: number;
  medianHalfWidth: number;
  gini: number;
  lorenzAtMedian: number;
  t: number;
  wolfson: number;
  meanOverMedian: number;
  degenerateFlag: boolean;
  degenerateReason: WolfsonDegenerateReason | null;
} {
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthWolfson: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthWolfson: halfWidths must be non-negative (got ${v})`,
      );
    }
  }
  const n = halfWidths.length;
  if (n < MIN_SHARED_SOURCES) {
    return {
      nShared: n,
      meanHalfWidth: 0,
      medianHalfWidth: 0,
      gini: 0,
      lorenzAtMedian: 0.5,
      t: 0,
      wolfson: 0,
      meanOverMedian: 0,
      degenerateFlag: true,
      degenerateReason: 'too-few-sources',
    };
  }
  let total = 0;
  for (const v of halfWidths) total += v;
  const mean = total / n;
  if (!(mean > 0) || !Number.isFinite(mean)) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      medianHalfWidth: 0,
      gini: 0,
      lorenzAtMedian: 0.5,
      t: 0,
      wolfson: 0,
      meanOverMedian: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-mean',
    };
  }
  const med = median(halfWidths);
  if (!(med > 0) || !Number.isFinite(med)) {
    return {
      nShared: n,
      meanHalfWidth: mean,
      medianHalfWidth: med,
      gini: 0,
      lorenzAtMedian: 0.5,
      t: 0,
      wolfson: 0,
      meanOverMedian: 0,
      degenerateFlag: true,
      degenerateReason: 'zero-median',
    };
  }

  const sorted = [...halfWidths].sort((a, b) => a - b);
  const gini = giniSorted(sorted);
  const lAtHalf = lorenzAtHalf(sorted);
  const t = 0.5 - lAtHalf;
  const meanOverMedian = mean / med;
  const wolfson = 2 * (2 * t - gini) * meanOverMedian;

  return {
    nShared: n,
    meanHalfWidth: mean,
    medianHalfWidth: med,
    gini,
    lorenzAtMedian: lAtHalf,
    t,
    wolfson,
    meanOverMedian,
    degenerateFlag: false,
    degenerateReason: null,
  };
}

/**
 * Derived diagnostic: WOLFSON DECOMPOSITION.
 *
 * Decomposes the Wolfson index into its three multiplicative
 * components: the median-Lorenz-gap `gapAtMedian = (2*T - Gini)`
 * (the polarisation core; positive when the Lorenz curve dips
 * BELOW its average gap at the median point, i.e. mass is at
 * the extremes), the `meanOverMedian` amplifier (the right-skew
 * scaling), and the constant 2. Reported alongside the standard
 * `gini` and `t` so that callers can see WHICH component is
 * driving a given W reading.
 *
 *   wolfson = 2 * gapAtMedian * meanOverMedian
 *
 * Returns null on degenerate input.
 */
export function lensWidthWolfsonDecomposition(
  halfWidths: number[],
): {
  wolfson: number;
  gapAtMedian: number;
  meanOverMedian: number;
  gini: number;
  t: number;
  giniContribution: number;
  tContribution: number;
} | null {
  const w = lensWidthWolfson(halfWidths);
  if (w.degenerateFlag) return null;
  const gapAtMedian = 2 * w.t - w.gini;
  // Decompose 2*gapAtMedian = 4*T - 2*Gini; tag the two pieces
  // scaled by the same meanOverMedian amplifier so they sum to W.
  const tContribution = 4 * w.t * w.meanOverMedian;
  const giniContribution = -2 * w.gini * w.meanOverMedian;
  return {
    wolfson: w.wolfson,
    gapAtMedian,
    meanOverMedian: w.meanOverMedian,
    gini: w.gini,
    t: w.t,
    giniContribution,
    tContribution,
  };
}

/**
 * Derived diagnostic: ANCHOR SENSITIVITY SWEEP.
 *
 * Generalises the Wolfson construction by replacing the median
 * anchor `p = 0.5` with an arbitrary quantile anchor
 * `p in (0, 1)`. Reports the generalised-anchor index
 *
 *   W_p = 2 * (2 * T_p - Gini) * (mean / Q_p)
 *   T_p = p - L(p)
 *
 * where `Q_p` is the empirical p-quantile and `L(p)` is the
 * Lorenz curve at p. The standard Wolfson is recovered at
 * `p = 0.5`.
 *
 * Reports the ANCHOR-CURVE -- diagnostic for whether the W=W_0.5
 * reading is a feature of the median anchor specifically or
 * just a property of the distribution at any anchor. A
 * distribution that is bimodal AROUND THE MEDIAN will show
 * `W_0.5` as the local maximum of the curve; a distribution
 * with a single dominant outlier will show `W_p` monotone in p.
 *
 * Returns null on degenerate input. Returns +inf at any anchor
 * where the empirical p-quantile is 0.
 */
export function lensWidthWolfsonAnchorSweep(
  halfWidths: number[],
  ps: number[],
): { p: number; w: number; gini: number; t: number; q: number }[] | null {
  for (const p of ps) {
    if (!Number.isFinite(p) || p <= 0 || p >= 1) {
      throw new Error(
        `lensWidthWolfsonAnchorSweep: ps must be in (0, 1) (got ${p})`,
      );
    }
  }
  for (const v of halfWidths) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lensWidthWolfsonAnchorSweep: halfWidths must be finite (got ${v})`,
      );
    }
    if (v < 0) {
      throw new Error(
        `lensWidthWolfsonAnchorSweep: halfWidths must be non-negative (got ${v})`,
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
  const gini = giniSorted(sorted);

  // Linearly-interpolated empirical Lorenz curve and quantile.
  const lorenzAt = (p: number): number => {
    const kFloat = p * n;
    const kLow = Math.floor(kFloat);
    const kHigh = Math.ceil(kFloat);
    let cumLow = 0;
    for (let i = 0; i < kLow; i++) cumLow += sorted[i]!;
    if (kLow === kHigh) return cumLow / total;
    const cumHigh = cumLow + sorted[kLow]!;
    const shareLow = cumLow / total;
    const shareHigh = cumHigh / total;
    const pLow = kLow / n;
    const pHigh = kHigh / n;
    const frac = (p - pLow) / (pHigh - pLow);
    return shareLow + frac * (shareHigh - shareLow);
  };
  // Linear interp for the quantile (matches median() helper at p=0.5).
  const quantileAt = (p: number): number => {
    const idxFloat = p * n - 0.5;
    if (idxFloat <= 0) return sorted[0]!;
    if (idxFloat >= n - 1) return sorted[n - 1]!;
    const lo = Math.floor(idxFloat);
    const hi = Math.ceil(idxFloat);
    if (lo === hi) return sorted[lo]!;
    const frac = idxFloat - lo;
    return sorted[lo]! + frac * (sorted[hi]! - sorted[lo]!);
  };

  const out: { p: number; w: number; gini: number; t: number; q: number }[] = [];
  for (const p of ps) {
    const lp = lorenzAt(p);
    const tp = p - lp;
    const q = quantileAt(p);
    let w: number;
    if (!(q > 0) || !Number.isFinite(q)) {
      w = Infinity;
    } else {
      w = 2 * (2 * tp - gini) * (mean / q);
    }
    out.push({ p, w, gini, t: tp, q });
  }
  return out;
}

export function buildSourceRowTokenSlopeCiLensWidthWolfson(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensWidthWolfsonOptions = {},
): SourceRowTokenSlopeCiLensWidthWolfsonReport {
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
  const alertWolfson = opts.alertWolfson ?? null;
  if (alertWolfson !== null) {
    if (!Number.isFinite(alertWolfson) || alertWolfson < 0) {
      throw new Error(
        `alertWolfson must be a finite number >= 0 (got ${opts.alertWolfson})`,
      );
    }
  }
  const sort = opts.sort ?? 'wolfson-desc';
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
    SlopeLensWidthWolfsonLensName,
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
  for (const lens of SLOPE_LENS_WIDTH_WOLFSON_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_WIDTH_WOLFSON_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensWidthWolfsonLensRow[] = [];
  for (const lens of SLOPE_LENS_WIDTH_WOLFSON_LENS_NAMES) {
    const halfs: number[] = [];
    for (const s of sharedSources) {
      const r = lensReports[lens].get(s)!;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const halfW = (hi - lo) / 2;
      halfs.push(halfW);
    }
    const comp = lensWidthWolfson(halfs);
    rows.push({
      lens,
      nShared: comp.nShared,
      meanHalfWidth: comp.meanHalfWidth,
      medianHalfWidth: comp.medianHalfWidth,
      gini: comp.gini,
      lorenzAtMedian: comp.lorenzAtMedian,
      t: comp.t,
      wolfson: comp.wolfson,
      meanOverMedian: comp.meanOverMedian,
      polarisationSignLabel: classifyPolarisationSign(
        comp.wolfson,
        comp.degenerateFlag,
      ),
      polarisationLabel: classifyPolarisation(
        comp.wolfson,
        comp.degenerateFlag,
      ),
      degenerateFlag: comp.degenerateFlag,
      degenerateReason: comp.degenerateReason,
      perSourceHalfWidths: halfs,
      perSourceSources: [...sharedSources],
    });
  }

  const finite = rows.filter((r) => !r.degenerateFlag);
  const ws = finite.map((r) => r.wolfson);
  const meanW = ws.length > 0 ? ws.reduce((a, b) => a + b, 0) / ws.length : 0;
  const medianW = median(ws);
  const maxW = ws.length > 0 ? Math.max(...ws) : 0;
  const minW = ws.length > 0 ? Math.min(...ws) : 0;
  const rangeW = ws.length > 0 ? maxW - minW : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nExtreme = rows.filter(
    (r) => r.polarisationLabel === 'extreme',
  ).length;
  const nNearZero = rows.filter(
    (r) => r.polarisationLabel === 'near-zero',
  ).length;
  const nBipolarised = rows.filter(
    (r) => r.polarisationSignLabel === 'bipolarised',
  ).length;
  const nUnipolarised = rows.filter(
    (r) => r.polarisationSignLabel === 'unipolarised',
  ).length;

  let mostBipolarisedLens: SlopeLensWidthWolfsonLensName | null = null;
  let mostUnipolarisedLens: SlopeLensWidthWolfsonLensName | null = null;
  if (finite.length > 0) {
    let bestHi = -Infinity;
    let bestLo = Infinity;
    for (const r of finite) {
      if (r.wolfson > bestHi) {
        bestHi = r.wolfson;
        mostBipolarisedLens = r.lens;
      }
      if (r.wolfson < bestLo) {
        bestLo = r.wolfson;
        mostUnipolarisedLens = r.lens;
      }
    }
  }

  let filtered = rows;
  if (alertWolfson !== null) {
    filtered = filtered.filter((r) => Math.abs(r.wolfson) > alertWolfson);
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensWidthWolfsonLensRow,
      b: SourceRowTokenSlopeCiLensWidthWolfsonLensRow,
    ) => number
  > = {
    'wolfson-desc': (a, b) => b.wolfson - a.wolfson,
    'wolfson-asc': (a, b) => a.wolfson - b.wolfson,
    'abs-wolfson-desc': (a, b) => Math.abs(b.wolfson) - Math.abs(a.wolfson),
    'mean-halfwidth-desc': (a, b) => b.meanHalfWidth - a.meanHalfWidth,
    lens: (a, b) =>
      SLOPE_LENS_WIDTH_WOLFSON_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_WOLFSON_LENS_NAMES.indexOf(b.lens),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return (
      SLOPE_LENS_WIDTH_WOLFSON_LENS_NAMES.indexOf(a.lens) -
      SLOPE_LENS_WIDTH_WOLFSON_LENS_NAMES.indexOf(b.lens)
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
    alertWolfson,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    meanW,
    medianW,
    maxW,
    minW,
    rangeW,
    nDegenerate,
    nExtreme,
    nNearZero,
    nBipolarised,
    nUnipolarised,
    mostBipolarisedLens,
    mostUnipolarisedLens,
    rows: filtered,
  };
}

function fmtNum(x: number, digits = 4): string {
  if (!Number.isFinite(x)) {
    return x === Infinity ? 'inf' : x === -Infinity ? '-inf' : 'NaN';
  }
  return x.toFixed(digits);
}

export function renderSourceRowTokenSlopeCiLensWidthWolfson(
  r: SourceRowTokenSlopeCiLensWidthWolfsonReport,
  opts: {
    showSummary?: boolean;
    showPolarisationAggregate?: boolean;
    showLensAttribution?: boolean;
    showPerSourceWidths?: boolean;
    showDecomposition?: boolean;
    showAnchorSweep?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showPolarisationAggregate = opts.showPolarisationAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showPerSourceWidths = opts.showPerSourceWidths ?? false;
  const showDecomposition = opts.showDecomposition ?? false;
  const showAnchorSweep = opts.showAnchorSweep ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-width-wolfson');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-wolfson: ${r.alertWolfson ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens; meanW: ${fmtNum(r.meanW, 6)}; medianW: ${fmtNum(r.medianW, 6)}; maxW: ${fmtNum(r.maxW, 6)}; minW: ${fmtNum(r.minW, 6)}; rangeW: ${fmtNum(r.rangeW, 6)}; nExtreme: ${r.nExtreme}; nNearZero: ${r.nNearZero}; nBipolarised: ${r.nBipolarised}; nUnipolarised: ${r.nUnipolarised}; nDegen: ${r.nDegenerate}; mostBipolarised: ${r.mostBipolarisedLens ?? '-'}; mostUnipolarised: ${r.mostUnipolarisedLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no lenses)');
    return lines.join('\n');
  }
  lines.push(
    'lens               n     W          mean       median     gini       L(0.5)     T          mean/med   sign            polarisation        reason',
  );
  lines.push(
    '-----------------  ----  ---------  ---------  ---------  ---------  ---------  ---------  ---------  --------------  ------------------  ---------------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.lens.padEnd(17),
        String(row.nShared).padStart(4),
        fmtNum(row.wolfson, 6).padStart(9),
        fmtNum(row.meanHalfWidth, 6).padStart(9),
        fmtNum(row.medianHalfWidth, 6).padStart(9),
        fmtNum(row.gini, 6).padStart(9),
        fmtNum(row.lorenzAtMedian, 6).padStart(9),
        fmtNum(row.t, 6).padStart(9),
        fmtNum(row.meanOverMedian, 6).padStart(9),
        row.polarisationSignLabel.padEnd(14),
        row.polarisationLabel.padEnd(18),
        (row.degenerateReason ?? '-').padEnd(21),
      ].join('  '),
    );
    if (showSummary) {
      lines.push(
        `    summary: lens=${row.lens} n=${row.nShared} W=${fmtNum(row.wolfson, 6)} Gini=${fmtNum(row.gini, 6)} T=${fmtNum(row.t, 6)} mean/med=${fmtNum(row.meanOverMedian, 6)} sign=${row.polarisationSignLabel} polarisation=${row.polarisationLabel}`,
      );
    }
    if (showDecomposition) {
      if (row.degenerateFlag) {
        lines.push(`    decomposition: (degenerate)`);
      } else {
        const dec = lensWidthWolfsonDecomposition(row.perSourceHalfWidths);
        if (dec === null) {
          lines.push(`    decomposition: (degenerate)`);
        } else {
          lines.push(
            `    decomposition: W=${fmtNum(dec.wolfson, 6)} = 2 * gapAtMedian(${fmtNum(dec.gapAtMedian, 6)}) * mean/med(${fmtNum(dec.meanOverMedian, 6)}); tContrib=4*T*r=${fmtNum(dec.tContribution, 6)} giniContrib=-2*G*r=${fmtNum(dec.giniContribution, 6)} (sum=${fmtNum(dec.tContribution + dec.giniContribution, 6)})`,
          );
        }
      }
    }
    if (showAnchorSweep) {
      if (row.degenerateFlag) {
        lines.push(`    anchorSweep: (degenerate)`);
      } else {
        const sweep = lensWidthWolfsonAnchorSweep(
          row.perSourceHalfWidths,
          [0.25, 0.4, 0.5, 0.6, 0.75],
        );
        if (sweep === null) {
          lines.push(`    anchorSweep: (degenerate)`);
        } else {
          const parts = sweep.map(
            (s) =>
              `W(p=${fmtNum(s.p, 2)})=${Number.isFinite(s.w) ? fmtNum(s.w, 4) : 'inf'}`,
          );
          lines.push(
            `    anchorSweep: ${parts.join(' ')} (p=0.5 is the standard Wolfson; off-median anchors test whether bipolarisation is median-specific or anchor-invariant)`,
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
  if (showPolarisationAggregate && r.rows.length > 0) {
    const denom = r.rows.length;
    lines.push(
      `[polarisation aggregate] nExtreme=${r.nExtreme}/${denom} (${fmtNum(r.nExtreme / denom, 4)}) nNearZero=${r.nNearZero}/${denom} (${fmtNum(r.nNearZero / denom, 4)}) nBipolarised=${r.nBipolarised}/${denom} (${fmtNum(r.nBipolarised / denom, 4)}) nUnipolarised=${r.nUnipolarised}/${denom} (${fmtNum(r.nUnipolarised / denom, 4)}) nDegen=${r.nDegenerate}/${denom} (${fmtNum(r.nDegenerate / denom, 4)}) meanW=${fmtNum(r.meanW, 6)} medianW=${fmtNum(r.medianW, 6)} rangeW=${fmtNum(r.rangeW, 6)}`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    lines.push(
      `[lens attribution] mostBipolarised=${r.mostBipolarisedLens ?? '-'} (max W) mostUnipolarised=${r.mostUnipolarisedLens ?? '-'} (min W)`,
    );
  }
  return lines.join('\n');
}
