/**
 * source-row-token-slope-ci-curvature-second-derivative
 *
 * Per-source DISCRETE SECOND-DERIVATIVE CURVATURE diagnostic
 * (SIXTEENTH cross-lens axis) for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six
 * per-source slope CIs as v0.6.227-v0.6.242 (percentile bootstrap,
 * jackknife normal, BCa, studentized-t, ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL FIFTEEN prior cross-lens
 * diagnostics on a fundamental axis. Every prior axis is one of:
 *
 *   - a SCALE estimate of the six midpoints (midpoint-dispersion
 *     SD, MAE, scaled MAD, range coverage volume, gini, ...);
 *   - a single-lens identifier (LOO drop, precision-pull max,
 *     adversarial extreme, residual-Z outlier, MAD-vs-MAE tail
 *     lens);
 *   - an across-source rank/agreement statistic on lens pairs
 *     (Spearman/Kendall on per-lens midpoint vectors;
 *     containment nestedness; overlap-graph connectivity);
 *   - an order-restricted MONOTONIC fit (PAV isotonic precision-
 *     vs-midpoint, axis 15).
 *
 * NONE of the fifteen ask: "within ONE source, when the six
 * lenses are sorted by their CI WIDTH (precision proxy), what is
 * the DISCRETE SECOND-DERIVATIVE structure of the midpoints?"
 * The PAV isotonic axis 15 measures order-restricted MONOTONIC
 * fit (how well the midpoints respect a monotone ordering against
 * width). NON-monotone structure -- inflection points, peaks,
 * valleys, oscillation in the width-ordered midpoints -- is
 * INVISIBLE to PAV (PAV will simply collapse a peak into a single
 * plateau and report the same monotonicityScore as a flat run).
 * This 16th axis fills exactly that gap by measuring the
 * curvature directly via the second-difference operator
 *
 *   D2[k] = mid_{k+1} - 2 * mid_k + mid_{k-1}    for k = 1..4
 *
 * where mid_0..mid_5 are the six midpoints sorted by ascending CI
 * width. D2 = 0 ⇔ locally linear; D2 > 0 ⇔ locally convex (valley);
 * D2 < 0 ⇔ locally concave (peak).
 *
 * For each source we form 6 (width_k, mid_k) pairs:
 *   - width_k = hi_k - lo_k         (CI width; precision proxy)
 *   - mid_k   = (lo_k + hi_k) / 2   (point-estimate proxy)
 *
 * Then sort the six pairs by ascending width (canonical-order
 * tie-break) and compute the four interior second differences.
 *
 * Per-source columns:
 *
 *   - `widthOrder`      — lens canonical-name array sorted by
 *                         ascending width (ties: canonical order);
 *   - `widths`, `mids`  — sorted arrays parallel to widthOrder;
 *   - `secondDiffs`     — the four second-differences D2[1..4]
 *                         in width-sorted order;
 *   - `curvatureL2`     — sqrt(sum_k D2[k]^2). Total "wiggliness";
 *                         0 ⇔ midpoints lie on a perfect straight
 *                         line in width-sorted order. DEFAULT
 *                         SORT KEY.
 *   - `curvatureLinf`   — max_k |D2[k]|. Peak local curvature.
 *                         Locates the single sharpest bend.
 *   - `signChanges`     — number of sign changes between adjacent
 *                         non-zero entries of `secondDiffs` (zero
 *                         entries are skipped). 0 ⇔ purely
 *                         convex or purely concave or perfectly
 *                         linear; >= 1 ⇔ at least one inflection
 *                         point (the curve oscillates).
 *   - `peakIndex`       — argmax_k |D2[k]| in 0..3 (lens-index
 *                         k+1 in width-sorted order). Tie-break
 *                         favours the smallest index.
 *   - `peakLens`        — lens at width-sorted position
 *                         `peakIndex + 1` (the interior point
 *                         around which D2 is most extreme).
 *   - `peakSign`        — sign of the second difference at
 *                         `peakIndex`: +1 ⇔ convex/valley;
 *                         -1 ⇔ concave/peak; 0 ⇔ exactly linear
 *                         at peak (only when curvatureLinf == 0).
 *   - `convexitySum`    — sum_k D2[k]. Positive ⇔ net convex;
 *                         negative ⇔ net concave; 0 ⇔ balanced.
 *   - `convexityAbsSum` — sum_k |D2[k]|. Total absolute curvature
 *                         budget (denominator for the ratio
 *                         below).
 *   - `convexityScore`  — `convexitySum / convexityAbsSum` in
 *                         [-1, 1]. +1 ⇔ purely convex (every
 *                         non-zero D2 has the same positive
 *                         sign); -1 ⇔ purely concave; 0 ⇔
 *                         balanced / oscillatory. Convention:
 *                         when `convexityAbsSum == 0` (perfectly
 *                         linear midpoints), `convexityScore == 0`.
 *   - `convexityLabel`  — `convex` if convexityScore >= 0.5;
 *                         `concave` if convexityScore <= -0.5;
 *                         `mixed` otherwise.
 *   - `linearFlag`      — `curvatureL2 == 0` boolean. True ⇔ all
 *                         four second differences vanish (the six
 *                         midpoints lie on a straight line in
 *                         width-sorted order).
 *   - `oscillatoryFlag` — `signChanges >= 2` boolean. Two or more
 *                         sign changes in four interior D2s ⇒ at
 *                         least two inflection points ⇒ the
 *                         midpoints meaningfully oscillate as
 *                         width grows.
 *
 * Per-report aggregates: `meanCurvatureL2`, `medianCurvatureL2`,
 * `meanConvexityScore`, `nLinear` (count with `linearFlag`),
 * `nOscillatory` (count with `oscillatoryFlag`), `nConvex`
 * (convexityLabel == 'convex'), `nConcave`, `nMixed`,
 * `globalConvexityLabel` (mode of `convexityLabel`; ties favour
 * `convex` > `concave` > `mixed`), `globalPeakLens` (mode of
 * `peakLens`; canonical-order tie-break).
 *
 * Edge cases:
 *   - Source missing from any of the six lenses → not reported
 *     (counted in `droppedMissingLens`).
 *   - All six widths identical → widthOrder is the canonical lens
 *     order; second differences computed on canonical-order
 *     midpoints.
 *   - All six midpoints identical → all four second differences
 *     are 0; `curvatureL2 == 0`, `curvatureLinf == 0`,
 *     `signChanges == 0`, `peakIndex == 0`, `peakSign == 0`,
 *     `convexitySum == 0`, `convexityAbsSum == 0`,
 *     `convexityScore == 0`, `convexityLabel == 'mixed'`,
 *     `linearFlag == true`, `oscillatoryFlag == false`.
 *   - Source slope CI width zero from any lens → still consumed.
 *
 * CLI options:
 *   - `--alert-curvature <f>` — only emit sources whose
 *                               `curvatureL2` is strictly
 *                               GREATER than `f` (`f >= 0`);
 *                               surfaces non-linear sources;
 *   - `--alert-oscillatory`   — only emit sources whose
 *                               `oscillatoryFlag == true`
 *                               (signChanges >= 2); surfaces
 *                               sources whose width-ordered
 *                               midpoints have >= 2 inflection
 *                               points; composes independently
 *                               with `--alert-curvature`.
 *
 * Why a 16th axis: the 15th axis (PAV isotonic) measures
 * order-restricted MONOTONIC fit -- but PAV is INVISIBLE to
 * non-monotone structure, because pooling collapses any local
 * peak/valley into a single plateau. A source whose midpoints
 * trace a perfect "/\" (rises then falls as width grows) will
 * register identically to a source whose midpoints are a flat
 * constant under PAV: both yield a single-plateau fit. The
 * second-derivative axis is the only diagnostic that
 * distinguishes those two cases by directly measuring the local
 * curvature D2[k] and counting inflection points -- a high
 * `curvatureL2` with `oscillatoryFlag == true` is the signature
 * that the precision-vs-midpoint relationship is genuinely
 * NON-MONOTONE in width, an orthogonal warning that no
 * monotone-ordering diagnostic (axes 1-15) can surface.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_CURVATURE_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeCurvatureLensName =
  (typeof SLOPE_CURVATURE_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_CURVATURE_LENS_NAMES.length;
const N_INTERIOR = N_LENSES - 2; // = 4
const CONVEX_LABEL_THRESHOLD = 0.5;

export type ConvexityLabel = 'convex' | 'concave' | 'mixed';

export interface SourceRowTokenSlopeCiCurvatureSecondDerivativeOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertCurvature?: number | null;
  alertOscillatory?: boolean;
  top?: number | null;
  sort?:
    | 'curvature-l2-desc'
    | 'curvature-l2-asc'
    | 'curvature-linf-desc'
    | 'sign-changes-desc'
    | 'sign-changes-asc'
    | 'convexity-score-desc'
    | 'convexity-score-asc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiCurvatureSecondDerivativeRow {
  source: string;
  rowsKept: number;
  widthOrder: SlopeCurvatureLensName[];
  widths: number[];
  mids: number[];
  secondDiffs: number[];
  curvatureL2: number;
  curvatureLinf: number;
  signChanges: number;
  peakIndex: number;
  peakLens: SlopeCurvatureLensName;
  peakSign: number;
  convexitySum: number;
  convexityAbsSum: number;
  convexityScore: number;
  convexityLabel: ConvexityLabel;
  linearFlag: boolean;
  oscillatoryFlag: boolean;
}

export interface SourceRowTokenSlopeCiCurvatureSecondDerivativeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertCurvature: number | null;
  alertOscillatory: boolean;
  top: number | null;
  sort: NonNullable<
    SourceRowTokenSlopeCiCurvatureSecondDerivativeOptions['sort']
  >;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedAboveAlert: number;
  meanCurvatureL2: number;
  medianCurvatureL2: number;
  meanConvexityScore: number;
  nLinear: number;
  nOscillatory: number;
  nConvex: number;
  nConcave: number;
  nMixed: number;
  globalConvexityLabel: ConvexityLabel | null;
  globalPeakLens: SlopeCurvatureLensName | null;
  rows: SourceRowTokenSlopeCiCurvatureSecondDerivativeRow[];
}

const VALID_SORTS = [
  'curvature-l2-desc',
  'curvature-l2-asc',
  'curvature-linf-desc',
  'sign-changes-desc',
  'sign-changes-asc',
  'convexity-score-desc',
  'convexity-score-asc',
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
 * Discrete second differences D2[k] = ys[k+1] - 2*ys[k] + ys[k-1]
 * for k = 1..ys.length-2. Returns an array of length
 * `ys.length - 2` (empty when `ys.length < 3`).
 */
export function secondDifferences(ys: number[]): number[] {
  if (ys.length < 3) return [];
  const out: number[] = [];
  for (let k = 1; k < ys.length - 1; k++) {
    out.push(ys[k + 1]! - 2 * ys[k]! + ys[k - 1]!);
  }
  return out;
}

/**
 * Count sign changes between adjacent NON-ZERO entries of `xs`.
 * Zero entries are skipped (treated as "no information"). Empty
 * input or fewer than two non-zero entries → 0.
 */
export function signChangeCount(xs: number[]): number {
  let prevSign = 0;
  let changes = 0;
  for (const x of xs) {
    if (x === 0) continue;
    const s = x > 0 ? 1 : -1;
    if (prevSign !== 0 && s !== prevSign) changes += 1;
    prevSign = s;
  }
  return changes;
}

/**
 * Pure helper: given parallel widths and mids in CANONICAL lens
 * order, compute the second-derivative curvature diagnostic.
 *
 * Exposed for direct unit-testing.
 */
export function curvatureSecondDerivative(
  widths: number[],
  mids: number[],
): {
  widthOrder: SlopeCurvatureLensName[];
  widths: number[];
  mids: number[];
  secondDiffs: number[];
  curvatureL2: number;
  curvatureLinf: number;
  signChanges: number;
  peakIndex: number;
  peakLens: SlopeCurvatureLensName;
  peakSign: number;
  convexitySum: number;
  convexityAbsSum: number;
  convexityScore: number;
  convexityLabel: ConvexityLabel;
  linearFlag: boolean;
  oscillatoryFlag: boolean;
} {
  if (widths.length !== N_LENSES || mids.length !== N_LENSES) {
    throw new Error(
      `curvatureSecondDerivative: expected ${N_LENSES} widths and ${N_LENSES} midpoints (got widths=${widths.length}, mids=${mids.length})`,
    );
  }
  for (const w of widths) {
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(
        `curvatureSecondDerivative: widths must be finite and non-negative (got ${w})`,
      );
    }
  }
  for (const m of mids) {
    if (!Number.isFinite(m)) {
      throw new Error(
        `curvatureSecondDerivative: midpoints must be finite (got ${m})`,
      );
    }
  }

  // Stable sort lens indices by ascending width; canonical-order tie-break.
  const idx: number[] = [];
  for (let i = 0; i < N_LENSES; i++) idx.push(i);
  idx.sort((a, b) => {
    const dw = widths[a]! - widths[b]!;
    if (dw !== 0) return dw;
    return a - b;
  });

  const widthOrder: SlopeCurvatureLensName[] = idx.map(
    (i) => SLOPE_CURVATURE_LENS_NAMES[i]!,
  );
  const sortedWidths = idx.map((i) => widths[i]!);
  const sortedMids = idx.map((i) => mids[i]!);

  const secondDiffs = secondDifferences(sortedMids);

  let sumSq = 0;
  let maxAbs = 0;
  let peakIndex = 0;
  let convexitySum = 0;
  let convexityAbsSum = 0;
  for (let k = 0; k < secondDiffs.length; k++) {
    const d = secondDiffs[k]!;
    sumSq += d * d;
    convexitySum += d;
    const ad = Math.abs(d);
    convexityAbsSum += ad;
    if (ad > maxAbs) {
      maxAbs = ad;
      peakIndex = k;
    }
  }
  const curvatureL2 = Math.sqrt(sumSq);
  const curvatureLinf = maxAbs;
  const signChanges = signChangeCount(secondDiffs);

  const peakValue = secondDiffs[peakIndex] ?? 0;
  const peakSign = peakValue > 0 ? 1 : peakValue < 0 ? -1 : 0;
  // peakLens is the INTERIOR midpoint at width-sorted position
  // (peakIndex + 1) since secondDiffs[k] is centered on mid[k+1].
  const peakLens = widthOrder[peakIndex + 1]!;

  let convexityScore: number;
  if (convexityAbsSum === 0) {
    convexityScore = 0;
  } else {
    const raw = convexitySum / convexityAbsSum;
    convexityScore = raw < -1 ? -1 : raw > 1 ? 1 : raw;
  }

  let convexityLabel: ConvexityLabel;
  if (convexityScore >= CONVEX_LABEL_THRESHOLD) convexityLabel = 'convex';
  else if (convexityScore <= -CONVEX_LABEL_THRESHOLD) convexityLabel = 'concave';
  else convexityLabel = 'mixed';

  const linearFlag = curvatureL2 === 0;
  const oscillatoryFlag = signChanges >= 2;

  return {
    widthOrder,
    widths: sortedWidths,
    mids: sortedMids,
    secondDiffs,
    curvatureL2,
    curvatureLinf,
    signChanges,
    peakIndex,
    peakLens,
    peakSign,
    convexitySum,
    convexityAbsSum,
    convexityScore,
    convexityLabel,
    linearFlag,
    oscillatoryFlag,
  };
}

export function buildSourceRowTokenSlopeCiCurvatureSecondDerivative(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiCurvatureSecondDerivativeOptions = {},
): SourceRowTokenSlopeCiCurvatureSecondDerivativeReport {
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
  const alertCurvature = opts.alertCurvature ?? null;
  if (alertCurvature !== null) {
    if (!Number.isFinite(alertCurvature) || alertCurvature < 0) {
      throw new Error(
        `alertCurvature must be a finite, non-negative number (got ${opts.alertCurvature})`,
      );
    }
  }
  const alertOscillatory = opts.alertOscillatory ?? false;
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'curvature-l2-desc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
    );
  }

  // Silence unused-variable if N_INTERIOR is only documentary.
  void N_INTERIOR;

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
  const lensReports: Record<SlopeCurvatureLensName, Map<string, PerLensRaw>> = {
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
  for (const lens of SLOPE_CURVATURE_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_CURVATURE_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiCurvatureSecondDerivativeRow[] = [];
  for (const s of sharedSources) {
    const widths: number[] = [];
    const mids: number[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_CURVATURE_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      widths.push(hi - lo);
      mids.push((lo + hi) / 2);
    }
    const computed = curvatureSecondDerivative(widths, mids);
    rows.push({
      source: s,
      rowsKept,
      ...computed,
    });
  }

  const l2s = rows.map((r) => r.curvatureL2);
  const meanCurvatureL2 =
    l2s.length > 0 ? l2s.reduce((a, b) => a + b, 0) / l2s.length : 0;
  const medianCurvatureL2 = median(l2s);
  const convScores = rows.map((r) => r.convexityScore);
  const meanConvexityScore =
    convScores.length > 0
      ? convScores.reduce((a, b) => a + b, 0) / convScores.length
      : 0;
  const nLinear = rows.filter((r) => r.linearFlag).length;
  const nOscillatory = rows.filter((r) => r.oscillatoryFlag).length;
  const nConvex = rows.filter((r) => r.convexityLabel === 'convex').length;
  const nConcave = rows.filter((r) => r.convexityLabel === 'concave').length;
  const nMixed = rows.filter((r) => r.convexityLabel === 'mixed').length;

  let globalConvexityLabel: ConvexityLabel | null = null;
  let globalPeakLens: SlopeCurvatureLensName | null = null;
  if (rows.length > 0) {
    // Mode of convexityLabel; ties favour convex > concave > mixed.
    const counts: Record<ConvexityLabel, number> = {
      convex: nConvex,
      concave: nConcave,
      mixed: nMixed,
    };
    const labelOrder: ConvexityLabel[] = ['convex', 'concave', 'mixed'];
    let maxC = -1;
    for (const lab of labelOrder) {
      if (counts[lab] > maxC) {
        maxC = counts[lab];
        globalConvexityLabel = lab;
      }
    }
    // Mode of peakLens with canonical-order tie-break.
    const peakCounts = new Map<SlopeCurvatureLensName, number>();
    for (const lens of SLOPE_CURVATURE_LENS_NAMES) peakCounts.set(lens, 0);
    for (const r of rows) {
      peakCounts.set(r.peakLens, peakCounts.get(r.peakLens)! + 1);
    }
    let maxP = -1;
    for (const lens of SLOPE_CURVATURE_LENS_NAMES) {
      const c = peakCounts.get(lens)!;
      if (c > maxP) {
        maxP = c;
        globalPeakLens = lens;
      }
    }
  }

  let droppedAboveAlert = 0;
  let filtered = rows;
  if (alertCurvature !== null) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.curvatureL2 > alertCurvature);
    droppedAboveAlert += before - filtered.length;
  }
  if (alertOscillatory) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.oscillatoryFlag);
    droppedAboveAlert += before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiCurvatureSecondDerivativeRow,
      b: SourceRowTokenSlopeCiCurvatureSecondDerivativeRow,
    ) => number
  > = {
    'curvature-l2-desc': (a, b) => b.curvatureL2 - a.curvatureL2,
    'curvature-l2-asc': (a, b) => a.curvatureL2 - b.curvatureL2,
    'curvature-linf-desc': (a, b) => b.curvatureLinf - a.curvatureLinf,
    'sign-changes-desc': (a, b) => b.signChanges - a.signChanges,
    'sign-changes-asc': (a, b) => a.signChanges - b.signChanges,
    'convexity-score-desc': (a, b) => b.convexityScore - a.convexityScore,
    'convexity-score-asc': (a, b) => a.convexityScore - b.convexityScore,
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
    alertCurvature,
    alertOscillatory,
    top,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    droppedAboveAlert,
    meanCurvatureL2,
    medianCurvatureL2,
    meanConvexityScore,
    nLinear,
    nOscillatory,
    nConvex,
    nConcave,
    nMixed,
    globalConvexityLabel,
    globalPeakLens,
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
 * Plain-text renderer. Self-contained, no chalk dependency.
 *
 * When `showSummary` is true, a compact one-line summary is
 * appended after each source row naming the convexity label,
 * peak lens / sign, curvatureL2, and explicit "(linear)" /
 * "(oscillatory)" flags when set.
 *
 * When `showCurvatureAggregate` is true, a single "[curvature
 * aggregate]" line is appended AFTER the table summarizing
 * meanCurvatureL2, the linear/oscillatory counts, and the
 * dominant convexity label.
 */
export function renderSourceRowTokenSlopeCiCurvatureSecondDerivative(
  r: SourceRowTokenSlopeCiCurvatureSecondDerivativeReport,
  opts: {
    showSummary?: boolean;
    showCurvatureAggregate?: boolean;
    showConvexityAggregate?: boolean;
    showPeakAttribution?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showCurvatureAggregate = opts.showCurvatureAggregate ?? false;
  const showConvexityAggregate = opts.showConvexityAggregate ?? false;
  const showPeakAttribution = opts.showPeakAttribution ?? false;
  const lines: string[] = [];
  lines.push(
    'pew-insights source-row-token-slope-ci-curvature-second-derivative',
  );
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-curvature: ${r.alertCurvature ?? '-'}    alert-oscillatory: ${r.alertOscillatory}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedAboveAlert} filtered-by-alert; meanCurvatureL2: ${fmtNum(r.meanCurvatureL2)}; medianCurvatureL2: ${fmtNum(r.medianCurvatureL2)}; meanConvexityScore: ${fmtNum(r.meanConvexityScore)}; nLinear: ${r.nLinear}; nOscillatory: ${r.nOscillatory}; nConvex: ${r.nConvex}; nConcave: ${r.nConcave}; nMixed: ${r.nMixed}; globalConvexityLabel: ${r.globalConvexityLabel ?? '-'}; globalPeakLens: ${r.globalPeakLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  peakLens           peakSign  curvL2      curvLinf    signCh  convScore  convLabel  flags',
  );
  lines.push(
    '---------------  ----  -----------------  --------  ----------  ----------  ------  ---------  ---------  -----',
  );
  for (const row of r.rows) {
    const flags: string[] = [];
    if (row.linearFlag) flags.push('linear');
    if (row.oscillatoryFlag) flags.push('oscill');
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        row.peakLens.padEnd(17),
        String(row.peakSign).padStart(8),
        fmtNum(row.curvatureL2).padStart(10),
        fmtNum(row.curvatureLinf).padStart(10),
        String(row.signChanges).padStart(6),
        fmtNum(row.convexityScore).padStart(9),
        row.convexityLabel.padEnd(9),
        (flags.join(',') || '-').padEnd(5),
      ].join('  '),
    );
    if (showSummary) {
      const flagStr = flags.length > 0 ? ` (${flags.join(',')})` : '';
      lines.push(
        `    summary: ${row.convexityLabel} peak=${row.peakLens}(sign=${row.peakSign}) L2=${fmtNum(row.curvatureL2)} signChanges=${row.signChanges}${flagStr}`,
      );
    }
  }
  if (showCurvatureAggregate && r.rows.length > 0) {
    const linFrac = r.nLinear / r.rows.length;
    const oscFrac = r.nOscillatory / r.rows.length;
    lines.push(
      `[curvature aggregate] meanCurvatureL2=${fmtNum(r.meanCurvatureL2)} medianCurvatureL2=${fmtNum(r.medianCurvatureL2)} nLinear=${r.nLinear}/${r.rows.length} (${fmtNum(linFrac, 4)}) nOscillatory=${r.nOscillatory}/${r.rows.length} (${fmtNum(oscFrac, 4)}) globalPeakLens=${r.globalPeakLens ?? '-'}`,
    );
  }
  if (showConvexityAggregate && r.rows.length > 0) {
    const cvxFrac = r.nConvex / r.rows.length;
    const ccvFrac = r.nConcave / r.rows.length;
    const mxFrac = r.nMixed / r.rows.length;
    lines.push(
      `[convexity aggregate] convex=${r.nConvex}/${r.rows.length} (${fmtNum(cvxFrac, 4)}) concave=${r.nConcave}/${r.rows.length} (${fmtNum(ccvFrac, 4)}) mixed=${r.nMixed}/${r.rows.length} (${fmtNum(mxFrac, 4)}) meanConvexityScore=${fmtNum(r.meanConvexityScore)} globalConvexityLabel=${r.globalConvexityLabel ?? '-'}`,
    );
  }
  if (showPeakAttribution && r.rows.length > 0) {
    // Per-lens histogram of how many sources peak at that lens.
    // Iterate canonical-order so output is stable and reproducible.
    const counts = new Map<SlopeCurvatureLensName, number>();
    for (const lens of SLOPE_CURVATURE_LENS_NAMES) counts.set(lens, 0);
    for (const row of r.rows) {
      counts.set(row.peakLens, counts.get(row.peakLens)! + 1);
    }
    const parts: string[] = [];
    for (const lens of SLOPE_CURVATURE_LENS_NAMES) {
      const c = counts.get(lens)!;
      const frac = c / r.rows.length;
      parts.push(`${lens}=${c}/${r.rows.length} (${fmtNum(frac, 4)})`);
    }
    lines.push(
      `[peak attribution] ${parts.join(' ')} globalPeakLens=${r.globalPeakLens ?? '-'}`,
    );
  }
  return lines.join('\n');
}
