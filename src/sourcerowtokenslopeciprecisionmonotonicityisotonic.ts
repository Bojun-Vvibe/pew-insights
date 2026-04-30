/**
 * source-row-token-slope-ci-precision-monotonicity-isotonic
 *
 * Per-source ORDER-RESTRICTED PRECISION-vs-MIDPOINT MONOTONICITY
 * diagnostic (FIFTEENTH cross-lens axis) for the v0.6.219
 * Deming-slope uncertainty-quantification suite. Consumes the
 * same six per-source slope CIs as v0.6.227-v0.6.241 (percentile
 * bootstrap, jackknife normal, BCa, studentized-t, ABC,
 * profile-likelihood).
 *
 * Mechanically distinct from ALL FOURTEEN prior cross-lens
 * diagnostics on a fundamental axis. Every prior axis is one of:
 *
 *   - a SCALE estimate of the six midpoints (midpoint dispersion
 *     SD, MAE, scaled MAD, range coverage volume, gini, ...);
 *   - a single-lens identifier (LOO drop, precision-pull max,
 *     adversarial extreme, residual-Z outlier, tail lens of the
 *     MAD-vs-MAE divergence);
 *   - an across-source rank/agreement statistic on lens pairs
 *     (Spearman/Kendall on per-lens midpoint vectors;
 *     containment nestedness; overlap-graph connectivity).
 *
 * NONE of the fourteen ask: "within ONE source, when the six
 * lenses are sorted by their CI WIDTH (precision proxy), do
 * their MIDPOINTS form a MONOTONE sequence?" That is, is there
 * an order-restricted relationship between how PRECISE a lens
 * thinks the slope is and WHERE it thinks the slope sits? An
 * isotonic precision-vs-midpoint relationship is the canonical
 * signature of width-dependent BIAS — narrower CIs tend to
 * cluster on one side of the true slope and wider CIs on the
 * other — orthogonal to ALL of the prior axes' questions.
 *
 * For each source we form 6 (width_k, mid_k) pairs:
 *   - width_k = hi_k - lo_k         (CI width; precision proxy)
 *   - mid_k   = (lo_k + hi_k) / 2   (point-estimate proxy)
 *
 * Then sort the six pairs by ascending width and fit a Pool-
 * Adjacent-Violators (PAV) isotonic regression of midpoints in
 * BOTH directions (monotone-increasing and monotone-decreasing
 * as width grows), picking the direction with the smaller fit
 * residual sum of squares.
 *
 * Per-source columns:
 *
 *   - `widthOrder`      — lens canonical-name array sorted by
 *                         ascending width (ties: canonical order).
 *   - `widths`          — sorted widths (parallel to widthOrder).
 *   - `mids`            — midpoints in the same width-sorted
 *                         order (parallel to widthOrder).
 *   - `tssMid`          — total sum of squares of mids around
 *                         their arithmetic mean. Reference
 *                         "constant model" SSE; floor for the
 *                         monotonicity gain.
 *   - `sseInc`          — residual sum of squares of the PAV
 *                         monotone-increasing isotonic fit on
 *                         (sorted-width, midpoint) pairs with
 *                         equal weights.
 *   - `sseDec`          — residual sum of squares of the PAV
 *                         monotone-decreasing fit (PAV on the
 *                         negated mids, then negated back).
 *   - `direction`       — 'increasing' if `sseInc <= sseDec`,
 *                         else 'decreasing'. Tie-break favours
 *                         'increasing' (precision-tightens-as-
 *                         midpoint-grows is the conventional
 *                         narrative).
 *   - `sseChosen`       — `min(sseInc, sseDec)`.
 *   - `monotonicityScore`
 *                       — `1 - sseChosen / tssMid` clamped to
 *                         [0, 1]. Equals 1 ⇔ chosen direction
 *                         fits the midpoints exactly (perfect
 *                         monotone precision-vs-midpoint
 *                         relationship); equals 0 ⇔ no
 *                         improvement over the constant model
 *                         (no monotonicity at all). Convention:
 *                         when `tssMid == 0` (all midpoints
 *                         identical), `monotonicityScore == 1`
 *                         and `direction == 'increasing'`
 *                         (degenerate-flat is monotone in both
 *                         directions and we choose the canonical
 *                         tie-break). DEFAULT SORT KEY.
 *   - `flatRunCount`    — number of distinct PAV plateaus in
 *                         the chosen-direction fit. 1 means the
 *                         fit collapsed to a single constant
 *                         (no monotone structure detected by
 *                         PAV); 6 means every adjacent pair
 *                         strictly respects the chosen ordering.
 *                         Coarser-grained complement to
 *                         monotonicityScore.
 *   - `crossoverIndex`  — index (0-based) of the first PAV
 *                         plateau-boundary in the chosen
 *                         direction's fit, or -1 if there is no
 *                         crossover (single plateau). Locates
 *                         WHERE in the width-sorted sequence the
 *                         monotone structure first asserts
 *                         itself.
 *   - `narrowestLens`   — lens at index 0 of widthOrder.
 *   - `widestLens`      — lens at index 5 of widthOrder.
 *   - `narrowestMid`    — mid of narrowestLens.
 *   - `widestMid`       — mid of widestLens.
 *   - `widthSpan`       — `widths[5] - widths[0]` (range of
 *                         widths across the six lenses; 0 ⇔ all
 *                         lenses share an identical CI width).
 *   - `monotoneFlag`    — `monotonicityScore >= 0.95`. Boolean
 *                         "this source has a strongly monotone
 *                         precision-vs-midpoint relationship"
 *                         signal. Threshold chosen so that
 *                         random / no-structure data (where the
 *                         best PAV direction explains a small
 *                         fraction of variance) does not trip
 *                         the flag.
 *
 * Per-report aggregates: `meanMonotonicityScore`,
 * `medianMonotonicityScore`, `nMonotone` (count with
 * `monotoneFlag == true`), `nIncreasing`, `nDecreasing`,
 * `globalDirection` (mode of `direction`; ties broken
 * `increasing` > `decreasing`), `globalNarrowestLens` (mode of
 * `narrowestLens`, canonical-order tie-break), `globalWidestLens`
 * (mode of `widestLens`, canonical-order tie-break).
 *
 * Edge cases:
 *   - Source missing from any of the six lenses → not reported
 *     (counted in `droppedMissingLens`).
 *   - All six widths identical → widthOrder is the canonical
 *     lens order; PAV still runs, monotonicityScore reflects
 *     midpoint structure under the canonical-order anchor.
 *   - All six midpoints identical → `tssMid == 0`, `sseInc == 0`,
 *     `sseDec == 0`, `monotonicityScore == 1`, `direction ==
 *     'increasing'`, `flatRunCount == 1`, `crossoverIndex == -1`.
 *   - Source slope CI width zero from any lens → still consumed;
 *     widthOrder will sort it to position 0 (canonical tie-break
 *     among equal widths).
 *
 * CLI options:
 *   - `--alert-monotone <f>`   — only emit sources whose
 *                                `monotonicityScore` is strictly
 *                                GREATER than f (0 < f < 1).
 *                                Surfaces strongly biased
 *                                sources for inspection.
 *   - `--alert-flat`           — only emit sources whose
 *                                `flatRunCount == 1` (PAV
 *                                collapsed entirely to a single
 *                                plateau). Composes
 *                                independently with
 *                                `--alert-monotone`.
 *
 * Why a 15th axis: the prior 14 axes ignore CI WIDTHS as an
 * ORDERING variable. Width-concordance (v0.6.228) treats widths
 * as a vector to correlate ACROSS SOURCES per-lens; coverage
 * volume / midpoint dispersion treat widths as a magnitude.
 * NONE of them sort the six lenses BY width WITHIN one source
 * and ask whether the midpoints are monotone in that order. This
 * 15th axis is the only diagnostic for the precision-bias
 * relationship — a high `monotonicityScore` with `direction ==
 * 'increasing'` is the signature that narrower-CI lenses
 * systematically estimate smaller slopes than wider-CI lenses
 * for that source, a reproducible and orthogonal warning that
 * the choice of uncertainty quantifier is co-varying with the
 * point estimate.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_PRECISION_MONOTONICITY_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopePrecisionMonotonicityLensName =
  (typeof SLOPE_PRECISION_MONOTONICITY_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_PRECISION_MONOTONICITY_LENS_NAMES.length;
const MONOTONE_THRESHOLD = 0.95;

export type IsotonicDirection = 'increasing' | 'decreasing';

export interface SourceRowTokenSlopeCiPrecisionMonotonicityIsotonicOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertMonotone?: number | null;
  alertFlat?: boolean;
  top?: number | null;
  sort?:
    | 'monotonicity-desc'
    | 'monotonicity-asc'
    | 'flat-run-asc'
    | 'flat-run-desc'
    | 'width-span-desc'
    | 'width-span-asc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiPrecisionMonotonicityIsotonicRow {
  source: string;
  rowsKept: number;
  widthOrder: SlopePrecisionMonotonicityLensName[];
  widths: number[];
  mids: number[];
  tssMid: number;
  sseInc: number;
  sseDec: number;
  direction: IsotonicDirection;
  sseChosen: number;
  monotonicityScore: number;
  flatRunCount: number;
  crossoverIndex: number;
  narrowestLens: SlopePrecisionMonotonicityLensName;
  widestLens: SlopePrecisionMonotonicityLensName;
  narrowestMid: number;
  widestMid: number;
  widthSpan: number;
  monotoneFlag: boolean;
}

export interface SourceRowTokenSlopeCiPrecisionMonotonicityIsotonicReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertMonotone: number | null;
  alertFlat: boolean;
  top: number | null;
  sort: NonNullable<
    SourceRowTokenSlopeCiPrecisionMonotonicityIsotonicOptions['sort']
  >;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedAboveAlert: number;
  meanMonotonicityScore: number;
  medianMonotonicityScore: number;
  nMonotone: number;
  nIncreasing: number;
  nDecreasing: number;
  globalDirection: IsotonicDirection | null;
  globalNarrowestLens: SlopePrecisionMonotonicityLensName | null;
  globalWidestLens: SlopePrecisionMonotonicityLensName | null;
  rows: SourceRowTokenSlopeCiPrecisionMonotonicityIsotonicRow[];
}

const VALID_SORTS = [
  'monotonicity-desc',
  'monotonicity-asc',
  'flat-run-asc',
  'flat-run-desc',
  'width-span-desc',
  'width-span-asc',
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
 * Pool-Adjacent-Violators isotonic regression.
 *
 * Returns a parallel array `fit[i]` of the same length as `ys`
 * such that `fit` is monotone non-decreasing and minimizes
 * `sum_i (ys[i] - fit[i])^2` under that constraint with EQUAL
 * weights (equal weights are sufficient for our application
 * because every lens contributes one (width, mid) pair).
 *
 * Standard pool-merge implementation: walk left-to-right,
 * pushing each new point as a singleton block and repeatedly
 * merging with the previous block whenever its mean violates
 * the non-decreasing constraint. O(n) amortized.
 */
export function pavIncreasing(ys: number[]): number[] {
  const n = ys.length;
  if (n === 0) return [];
  // Each block stored as { sum, count, end } where `end` is the
  // last index covered by the block (inclusive).
  const blockSum: number[] = [];
  const blockCount: number[] = [];
  const blockEnd: number[] = [];
  for (let i = 0; i < n; i++) {
    let curSum = ys[i]!;
    let curCount = 1;
    while (
      blockSum.length > 0 &&
      blockSum[blockSum.length - 1]! / blockCount[blockCount.length - 1]! >
        curSum / curCount
    ) {
      curSum += blockSum.pop()!;
      curCount += blockCount.pop()!;
      blockEnd.pop();
    }
    blockSum.push(curSum);
    blockCount.push(curCount);
    blockEnd.push(i);
  }
  const out: number[] = new Array(n);
  let start = 0;
  for (let b = 0; b < blockSum.length; b++) {
    const mean = blockSum[b]! / blockCount[b]!;
    const end = blockEnd[b]!;
    for (let i = start; i <= end; i++) out[i] = mean;
    start = end + 1;
  }
  return out;
}

/**
 * PAV monotone-decreasing fit: negate, fit increasing, negate back.
 */
export function pavDecreasing(ys: number[]): number[] {
  const negated = ys.map((y) => -y);
  const fit = pavIncreasing(negated);
  return fit.map((y) => -y);
}

/**
 * Count the number of distinct plateaus in a PAV fit. Adjacent
 * fit values that are exactly equal belong to the same plateau.
 */
export function countPlateaus(fit: number[]): number {
  if (fit.length === 0) return 0;
  let runs = 1;
  for (let i = 1; i < fit.length; i++) {
    if (fit[i] !== fit[i - 1]) runs += 1;
  }
  return runs;
}

/**
 * Index (0-based) of the first plateau boundary, or -1 if the
 * entire fit is a single plateau. The boundary index is the
 * SECOND element of the first pair that differs.
 */
export function firstCrossoverIndex(fit: number[]): number {
  for (let i = 1; i < fit.length; i++) {
    if (fit[i] !== fit[i - 1]) return i;
  }
  return -1;
}

function sse(ys: number[], fit: number[]): number {
  let s = 0;
  for (let i = 0; i < ys.length; i++) {
    const d = ys[i]! - fit[i]!;
    s += d * d;
  }
  return s;
}

/**
 * Pure helper: given parallel widths and mids in CANONICAL lens
 * order, compute the precision-monotonicity diagnostic. Returns
 * the per-source row WITHOUT `source` / `rowsKept` (those are
 * supplied by the builder).
 *
 * Exposed for direct unit-testing.
 */
export function precisionMonotonicityIsotonic(
  widths: number[],
  mids: number[],
): {
  widthOrder: SlopePrecisionMonotonicityLensName[];
  widths: number[];
  mids: number[];
  tssMid: number;
  sseInc: number;
  sseDec: number;
  direction: IsotonicDirection;
  sseChosen: number;
  monotonicityScore: number;
  flatRunCount: number;
  crossoverIndex: number;
  narrowestLens: SlopePrecisionMonotonicityLensName;
  widestLens: SlopePrecisionMonotonicityLensName;
  narrowestMid: number;
  widestMid: number;
  widthSpan: number;
  monotoneFlag: boolean;
} {
  if (widths.length !== N_LENSES || mids.length !== N_LENSES) {
    throw new Error(
      `precisionMonotonicityIsotonic: expected ${N_LENSES} widths and ${N_LENSES} midpoints (got widths=${widths.length}, mids=${mids.length})`,
    );
  }
  for (const w of widths) {
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(
        `precisionMonotonicityIsotonic: widths must be finite and non-negative (got ${w})`,
      );
    }
  }
  for (const m of mids) {
    if (!Number.isFinite(m)) {
      throw new Error(
        `precisionMonotonicityIsotonic: midpoints must be finite (got ${m})`,
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

  const widthOrder: SlopePrecisionMonotonicityLensName[] = idx.map(
    (i) => SLOPE_PRECISION_MONOTONICITY_LENS_NAMES[i]!,
  );
  const sortedWidths = idx.map((i) => widths[i]!);
  const sortedMids = idx.map((i) => mids[i]!);

  let sumMid = 0;
  for (const m of sortedMids) sumMid += m;
  const meanMid = sumMid / N_LENSES;
  let tssMid = 0;
  for (const m of sortedMids) {
    const d = m - meanMid;
    tssMid += d * d;
  }

  const fitInc = pavIncreasing(sortedMids);
  const fitDec = pavDecreasing(sortedMids);
  const sseInc = sse(sortedMids, fitInc);
  const sseDec = sse(sortedMids, fitDec);

  let direction: IsotonicDirection;
  let chosenFit: number[];
  if (sseInc <= sseDec) {
    direction = 'increasing';
    chosenFit = fitInc;
  } else {
    direction = 'decreasing';
    chosenFit = fitDec;
  }
  const sseChosen = direction === 'increasing' ? sseInc : sseDec;

  let monotonicityScore: number;
  if (tssMid === 0) {
    monotonicityScore = 1;
  } else {
    const raw = 1 - sseChosen / tssMid;
    monotonicityScore = raw < 0 ? 0 : raw > 1 ? 1 : raw;
  }

  const flatRunCount = countPlateaus(chosenFit);
  const crossoverIndex = firstCrossoverIndex(chosenFit);

  const narrowestLens = widthOrder[0]!;
  const widestLens = widthOrder[N_LENSES - 1]!;
  const narrowestMid = sortedMids[0]!;
  const widestMid = sortedMids[N_LENSES - 1]!;
  const widthSpan = sortedWidths[N_LENSES - 1]! - sortedWidths[0]!;

  const monotoneFlag = monotonicityScore >= MONOTONE_THRESHOLD;

  return {
    widthOrder,
    widths: sortedWidths,
    mids: sortedMids,
    tssMid,
    sseInc,
    sseDec,
    direction,
    sseChosen,
    monotonicityScore,
    flatRunCount,
    crossoverIndex,
    narrowestLens,
    widestLens,
    narrowestMid,
    widestMid,
    widthSpan,
    monotoneFlag,
  };
}

export function buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiPrecisionMonotonicityIsotonicOptions = {},
): SourceRowTokenSlopeCiPrecisionMonotonicityIsotonicReport {
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
  const alertMonotone = opts.alertMonotone ?? null;
  if (alertMonotone !== null) {
    if (
      !Number.isFinite(alertMonotone) ||
      alertMonotone <= 0 ||
      alertMonotone >= 1
    ) {
      throw new Error(
        `alertMonotone must be a finite number in (0, 1) (got ${opts.alertMonotone})`,
      );
    }
  }
  const alertFlat = opts.alertFlat ?? false;
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'monotonicity-desc';
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
    SlopePrecisionMonotonicityLensName,
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
  for (const lens of SLOPE_PRECISION_MONOTONICITY_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_PRECISION_MONOTONICITY_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiPrecisionMonotonicityIsotonicRow[] = [];
  for (const s of sharedSources) {
    const widths: number[] = [];
    const mids: number[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_PRECISION_MONOTONICITY_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      widths.push(hi - lo);
      mids.push((lo + hi) / 2);
    }
    const computed = precisionMonotonicityIsotonic(widths, mids);
    rows.push({
      source: s,
      rowsKept,
      ...computed,
    });
  }

  const scores = rows.map((r) => r.monotonicityScore);
  const meanMonotonicityScore =
    scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
  const medianMonotonicityScore = median(scores);
  const nMonotone = rows.filter((r) => r.monotoneFlag).length;
  const nIncreasing = rows.filter((r) => r.direction === 'increasing').length;
  const nDecreasing = rows.filter((r) => r.direction === 'decreasing').length;

  let globalDirection: IsotonicDirection | null = null;
  let globalNarrowestLens: SlopePrecisionMonotonicityLensName | null = null;
  let globalWidestLens: SlopePrecisionMonotonicityLensName | null = null;
  if (rows.length > 0) {
    globalDirection = nIncreasing >= nDecreasing ? 'increasing' : 'decreasing';
    const narrowCounts = new Map<SlopePrecisionMonotonicityLensName, number>();
    const wideCounts = new Map<SlopePrecisionMonotonicityLensName, number>();
    for (const lens of SLOPE_PRECISION_MONOTONICITY_LENS_NAMES) {
      narrowCounts.set(lens, 0);
      wideCounts.set(lens, 0);
    }
    for (const r of rows) {
      narrowCounts.set(r.narrowestLens, narrowCounts.get(r.narrowestLens)! + 1);
      wideCounts.set(r.widestLens, wideCounts.get(r.widestLens)! + 1);
    }
    let maxN = -1;
    let maxW = -1;
    for (const lens of SLOPE_PRECISION_MONOTONICITY_LENS_NAMES) {
      const cn = narrowCounts.get(lens)!;
      if (cn > maxN) {
        maxN = cn;
        globalNarrowestLens = lens;
      }
      const cw = wideCounts.get(lens)!;
      if (cw > maxW) {
        maxW = cw;
        globalWidestLens = lens;
      }
    }
  }

  let droppedAboveAlert = 0;
  let filtered = rows;
  if (alertMonotone !== null) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.monotonicityScore > alertMonotone);
    droppedAboveAlert += before - filtered.length;
  }
  if (alertFlat) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.flatRunCount === 1);
    droppedAboveAlert += before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiPrecisionMonotonicityIsotonicRow,
      b: SourceRowTokenSlopeCiPrecisionMonotonicityIsotonicRow,
    ) => number
  > = {
    'monotonicity-desc': (a, b) => b.monotonicityScore - a.monotonicityScore,
    'monotonicity-asc': (a, b) => a.monotonicityScore - b.monotonicityScore,
    'flat-run-asc': (a, b) => a.flatRunCount - b.flatRunCount,
    'flat-run-desc': (a, b) => b.flatRunCount - a.flatRunCount,
    'width-span-desc': (a, b) => b.widthSpan - a.widthSpan,
    'width-span-asc': (a, b) => a.widthSpan - b.widthSpan,
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
    alertMonotone,
    alertFlat,
    top,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    droppedAboveAlert,
    meanMonotonicityScore,
    medianMonotonicityScore,
    nMonotone,
    nIncreasing,
    nDecreasing,
    globalDirection,
    globalNarrowestLens,
    globalWidestLens,
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
 * appended after each source row naming the chosen direction,
 * narrowest/widest lens, monotonicityScore, and an explicit
 * "(monotone)" flag whenever `monotoneFlag` is true.
 *
 * When `showMonotoneAggregate` is true, a single "[monotone
 * aggregate]" line is appended AFTER the table summarizing the
 * fraction of sources crossing the 0.95 monotonicity threshold,
 * the dominant direction, narrowest lens, and widest lens.
 */
export function renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(
  r: SourceRowTokenSlopeCiPrecisionMonotonicityIsotonicReport,
  opts: { showSummary?: boolean; showMonotoneAggregate?: boolean } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showMonotoneAggregate = opts.showMonotoneAggregate ?? false;
  const lines: string[] = [];
  lines.push(
    'pew-insights source-row-token-slope-ci-precision-monotonicity-isotonic',
  );
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-monotone: ${r.alertMonotone ?? '-'}    alert-flat: ${r.alertFlat}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedAboveAlert} filtered-by-alert; meanMonotonicityScore: ${fmtNum(r.meanMonotonicityScore)}; medianMonotonicityScore: ${fmtNum(r.medianMonotonicityScore)}; nMonotone: ${r.nMonotone}; nIncreasing: ${r.nIncreasing}; nDecreasing: ${r.nDecreasing}; globalDirection: ${r.globalDirection ?? '-'}; globalNarrowestLens: ${r.globalNarrowestLens ?? '-'}; globalWidestLens: ${r.globalWidestLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  narrowLens         widestLens         widthSpan   narrowMid   widestMid   tssMid      sseChosen   direction     plat  cross  monoton',
  );
  lines.push(
    '---------------  ----  -----------------  -----------------  ----------  ----------  ----------  ----------  ----------  ------------  ----  -----  -------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        row.narrowestLens.padEnd(17),
        row.widestLens.padEnd(17),
        fmtNum(row.widthSpan).padStart(10),
        fmtNum(row.narrowestMid).padStart(10),
        fmtNum(row.widestMid).padStart(10),
        fmtNum(row.tssMid).padStart(10),
        fmtNum(row.sseChosen).padStart(10),
        row.direction.padEnd(12),
        String(row.flatRunCount).padStart(4),
        String(row.crossoverIndex).padStart(5),
        fmtNum(row.monotonicityScore).padStart(7),
      ].join('  '),
    );
    if (showSummary) {
      const arrow = row.direction === 'increasing' ? '↗' : '↘';
      const flag = row.monotoneFlag ? ' (monotone)' : '';
      lines.push(
        `    summary: ${arrow} ${row.direction} narrow=${row.narrowestLens} wide=${row.widestLens} score=${fmtNum(row.monotonicityScore)}${flag}`,
      );
    }
  }
  if (showMonotoneAggregate && r.rows.length > 0) {
    const frac = r.nMonotone / r.rows.length;
    lines.push(
      `[monotone aggregate] ${r.nMonotone}/${r.rows.length} sources crossed monotonicityScore>=0.95 (${fmtNum(frac, 4)}); globalDirection=${r.globalDirection ?? '-'}; globalNarrowestLens=${r.globalNarrowestLens ?? '-'}; globalWidestLens=${r.globalWidestLens ?? '-'}`,
    );
  }
  return lines.join('\n');
}
