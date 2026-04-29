/**
 * source-row-token-slope-ci-mad-vs-mae-divergence
 *
 * Per-source ROBUST-SCALE-vs-MEAN-SCALE divergence diagnostic for
 * the v0.6.219 Deming-slope uncertainty-quantification suite.
 * Consumes the SAME six per-source slope CIs as v0.6.227-v0.6.240
 * (percentile bootstrap, jackknife normal, BCa, studentized-t,
 * ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL THIRTEEN prior cross-lens
 * diagnostics on a fundamental axis: every prior axis collapses
 * the per-lens information into a single dispersion (gini,
 * Jaccard, range, midpoint dispersion = standard deviation of
 * midpoints, etc.) or a single-lens label (LOO, precision pull,
 * adversarial extreme, residual-Z outlier). NONE of them
 * COMPARE TWO scale estimates of the same midpoints to detect
 * the signature of a single-lens tail observation: an inflated
 * MEAN-absolute-error (MAE) relative to the BREAKDOWN-resistant
 * scaled MEDIAN-absolute-deviation (MAD).
 *
 * For each source we compute on the 6 CI midpoints
 * `mid_k = (lo_k + hi_k) / 2`:
 *
 *   - `equalMid` = arithmetic mean of mid_1..mid_6;
 *   - `medianMid` = median of mid_1..mid_6;
 *   - `mae` = arithmetic mean of |mid_k - equalMid|
 *     (mean absolute deviation around the mean — non-robust
 *     scale; one extreme midpoint inflates it linearly);
 *   - `mad` = median of |mid_k - medianMid|
 *     (Hampel's median absolute deviation around the median —
 *     50% breakdown point);
 *   - `madScaled` = `1.4826 * mad`
 *     (consistent estimator of the standard deviation under a
 *     Gaussian; lets MAE and MAD live on the same scale for
 *     direct subtraction);
 *   - `divergence` = `mae - madScaled`
 *     (signed; positive ⇔ MAE inflated above robust scale ⇔
 *     a single tail midpoint is dragging the non-robust scale up);
 *   - `divergenceRatio` = `mae / madScaled` when `madScaled > 0`,
 *     `Infinity` when `madScaled == 0` and `mae > 0`,
 *     1 by convention when both are 0
 *     (multiplicative form; >1 ⇔ MAE bigger; ≈1 ⇔ scales agree;
 *     <1 ⇔ rare branch where MAE is smaller than scaled-MAD,
 *     occurs when the median group is itself dispersed but the
 *     mean group clusters);
 *   - `tailLens` = lens k* maximizing `|mid_k - medianMid|`
 *     (canonical-order tie-break) — the lens whose midpoint
 *     is furthest from the median anchor and therefore the
 *     most likely candidate to be DRIVING any MAE inflation;
 *   - `tailDeviation` = `|mid_{k*} - medianMid|` (per-source
 *     headline residual against the robust anchor);
 *   - `tailDirection` ∈ {`up`, `down`, `neutral`} — sign of
 *     `mid_{k*} - medianMid`;
 *   - `breakdownFlag` = `divergenceRatio > 1.5` boolean
 *     (the crisp "non-robust scale is materially bigger than
 *     robust scale; a single tail observation is responsible"
 *     diagnostic. The 1.5 threshold is the standard rule-of-
 *     thumb upper edge for an "approximately Gaussian" MAE/MAD
 *     ratio; under iid normality MAE/MADscaled has expectation
 *     ≈ √(2/π) ÷ 1 ≈ 0.798, so anything above 1.5 is a strong
 *     scale-divergence signal);
 *   - `meanMedianGap` = `equalMid - medianMid` (signed; sign
 *     direction of skew of the six midpoints);
 *   - `skewDirection` ∈ {`right`, `left`, `symmetric`} —
 *     sign of `meanMedianGap`. `right` (positive gap) means a
 *     long upper tail (a few large midpoints pull mean above
 *     median); `left` is the mirror;
 *   - `robustnessScore` = `1 / (1 + |divergence| / (mae +
 *     madScaled + 1e-12))` in (0, 1] — DEFAULT SORT KEY.
 *     1.0 = MAE and scaled-MAD agree exactly (no tail-driven
 *     inflation); near 0 = the two scales disagree by their
 *     entire combined magnitude. Bounded form lets us rank
 *     sources without having to special-case the
 *     `madScaled == 0` branch.
 *
 * Per-report aggregates: `meanRobustnessScore`,
 * `medianRobustnessScore`, `meanDivergenceRatio`
 * (`divergenceRatio` arithmetic mean, treating Infinity as
 * skipped — see `nInfiniteRatio`), `nBreakdown` (count of
 * sources with `breakdownFlag == true`), `nInfiniteRatio`
 * (count of sources with `madScaled == 0 && mae > 0`),
 * `globalTailLens` (mode of `tailLens` across sources,
 * canonical-order tie-break), `globalSkewDirection` (mode of
 * `skewDirection`, ties broken `right` > `left` > `symmetric`).
 *
 * Edge cases:
 *   - Source dropped from any of the six lenses → not reported
 *     (counted in `droppedMissingLens`).
 *   - All six midpoints identical → `mae == 0`, `mad == 0`,
 *     `madScaled == 0`, `divergence == 0`, `divergenceRatio == 1`
 *     by convention, `breakdownFlag == false`,
 *     `robustnessScore == 1`, `skewDirection == 'symmetric'`,
 *     `tailDirection == 'neutral'`, `tailDeviation == 0`,
 *     `tailLens == 'bootstrap'` (canonical tie-break).
 *   - `madScaled == 0` && `mae > 0` (most lenses agree but a
 *     few outliers create a non-zero MAE) → `divergenceRatio`
 *     is `Infinity`, `breakdownFlag == true`, source counted
 *     in `nInfiniteRatio` and skipped from `meanDivergenceRatio`
 *     averaging.
 *
 * `--alert-divergent <f>` filters to sources whose
 * `robustnessScore` is strictly less than f (in (0, 1]) — the
 * sources with the worst MAE/MAD scale agreement.
 *
 * `--alert-breakdown` filters to sources where `breakdownFlag`
 * is true (independent of `--alert-divergent`; both compose).
 *
 * Why a 14th axis: every prior axis is a SCALE itself or a
 * single-lens identifier; NONE compare two scale estimates and
 * surface their divergence as a robust-vs-non-robust
 * tail-detection diagnostic. v0.6.231 midpoint-dispersion
 * reports a single (non-robust) standard-deviation-style
 * scale; v0.6.240 lens-residual-z normalizes by per-lens
 * widths, not by a robust source-level scale. This 14th axis
 * is the only one that asks "is the dispersion of the six
 * midpoints driven by ALL of them, or by ONE tail observation
 * that the median cleans away?" A large `divergenceRatio`
 * with `breakdownFlag == true` is the diagnostic signature
 * that one specific lens midpoint is an outlier in the
 * source-level distribution of midpoints — orthogonal to the
 * per-lens-CI question that residual-z asks.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_MAD_VS_MAE_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeMadVsMaeLensName =
  (typeof SLOPE_MAD_VS_MAE_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_MAD_VS_MAE_LENS_NAMES.length;
const MAD_GAUSSIAN_SCALE = 1.4826;
const BREAKDOWN_THRESHOLD = 1.5;

export type MadVsMaeSkewDirection = 'right' | 'left' | 'symmetric';
export type MadVsMaeTailDirection = 'up' | 'down' | 'neutral';

export interface SourceRowTokenSlopeCiMadVsMaeDivergenceOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertDivergent?: number | null;
  alertBreakdown?: boolean;
  top?: number | null;
  sort?:
    | 'robustness-desc'
    | 'robustness-asc'
    | 'divergence-ratio-desc'
    | 'divergence-ratio-asc'
    | 'tail-deviation-desc'
    | 'tail-deviation-asc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiMadVsMaeDivergenceRow {
  source: string;
  rowsKept: number;
  equalMid: number;
  medianMid: number;
  mae: number;
  mad: number;
  madScaled: number;
  divergence: number;
  divergenceRatio: number; // may be Infinity
  tailLens: SlopeMadVsMaeLensName;
  tailDeviation: number;
  tailDirection: MadVsMaeTailDirection;
  breakdownFlag: boolean;
  meanMedianGap: number;
  skewDirection: MadVsMaeSkewDirection;
  robustnessScore: number;
}

export interface SourceRowTokenSlopeCiMadVsMaeDivergenceReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertDivergent: number | null;
  alertBreakdown: boolean;
  top: number | null;
  sort: NonNullable<
    SourceRowTokenSlopeCiMadVsMaeDivergenceOptions['sort']
  >;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedAboveAlert: number;
  meanRobustnessScore: number;
  medianRobustnessScore: number;
  meanDivergenceRatio: number;
  nBreakdown: number;
  nInfiniteRatio: number;
  globalTailLens: SlopeMadVsMaeLensName | null;
  globalSkewDirection: MadVsMaeSkewDirection | null;
  rows: SourceRowTokenSlopeCiMadVsMaeDivergenceRow[];
}

const VALID_SORTS = [
  'robustness-desc',
  'robustness-asc',
  'divergence-ratio-desc',
  'divergence-ratio-asc',
  'tail-deviation-desc',
  'tail-deviation-asc',
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
 * Pure helper: given the 6 midpoints in canonical lens order,
 * compute the MAD-vs-MAE divergence diagnostic for that source.
 * Exposed for direct unit-testing.
 */
export function madVsMaeDivergence(mids: number[]): {
  equalMid: number;
  medianMid: number;
  mae: number;
  mad: number;
  madScaled: number;
  divergence: number;
  divergenceRatio: number;
  tailLens: SlopeMadVsMaeLensName;
  tailDeviation: number;
  tailDirection: MadVsMaeTailDirection;
  breakdownFlag: boolean;
  meanMedianGap: number;
  skewDirection: MadVsMaeSkewDirection;
  robustnessScore: number;
} {
  if (mids.length !== N_LENSES) {
    throw new Error(
      `madVsMaeDivergence: expected ${N_LENSES} midpoints (got ${mids.length})`,
    );
  }
  for (const m of mids) {
    if (!Number.isFinite(m)) {
      throw new Error(
        `madVsMaeDivergence: midpoints must be finite (got ${m})`,
      );
    }
  }

  let sumMid = 0;
  for (let i = 0; i < N_LENSES; i++) sumMid += mids[i]!;
  const equalMid = sumMid / N_LENSES;
  const medianMid = median(mids);

  let sumAbsMean = 0;
  const absDevMedian: number[] = new Array(N_LENSES);
  for (let i = 0; i < N_LENSES; i++) {
    sumAbsMean += Math.abs(mids[i]! - equalMid);
    absDevMedian[i] = Math.abs(mids[i]! - medianMid);
  }
  const mae = sumAbsMean / N_LENSES;
  const mad = median(absDevMedian);
  const madScaled = MAD_GAUSSIAN_SCALE * mad;
  const divergence = mae - madScaled;

  let divergenceRatio: number;
  if (madScaled === 0 && mae === 0) divergenceRatio = 1;
  else if (madScaled === 0) divergenceRatio = Infinity;
  else divergenceRatio = mae / madScaled;

  // tail lens = max abs deviation from median, canonical tie-break.
  let tailIdx = 0;
  let tailDeviation = absDevMedian[0]!;
  for (let i = 1; i < N_LENSES; i++) {
    if (absDevMedian[i]! > tailDeviation) {
      tailDeviation = absDevMedian[i]!;
      tailIdx = i;
    }
  }
  const tailLens = SLOPE_MAD_VS_MAE_LENS_NAMES[tailIdx]!;
  const tailSigned = mids[tailIdx]! - medianMid;
  let tailDirection: MadVsMaeTailDirection;
  if (tailSigned > 0) tailDirection = 'up';
  else if (tailSigned < 0) tailDirection = 'down';
  else tailDirection = 'neutral';

  const breakdownFlag = divergenceRatio > BREAKDOWN_THRESHOLD;

  const meanMedianGap = equalMid - medianMid;
  let skewDirection: MadVsMaeSkewDirection;
  if (meanMedianGap > 0) skewDirection = 'right';
  else if (meanMedianGap < 0) skewDirection = 'left';
  else skewDirection = 'symmetric';

  const denom = mae + madScaled + 1e-12;
  const robustnessScore = 1 / (1 + Math.abs(divergence) / denom);

  return {
    equalMid,
    medianMid,
    mae,
    mad,
    madScaled,
    divergence,
    divergenceRatio,
    tailLens,
    tailDeviation,
    tailDirection,
    breakdownFlag,
    meanMedianGap,
    skewDirection,
    robustnessScore,
  };
}

export function buildSourceRowTokenSlopeCiMadVsMaeDivergence(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiMadVsMaeDivergenceOptions = {},
): SourceRowTokenSlopeCiMadVsMaeDivergenceReport {
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
  const alertDivergent = opts.alertDivergent ?? null;
  if (alertDivergent !== null) {
    if (
      !Number.isFinite(alertDivergent) ||
      alertDivergent <= 0 ||
      alertDivergent > 1
    ) {
      throw new Error(
        `alertDivergent must be a finite number in (0, 1] (got ${opts.alertDivergent})`,
      );
    }
  }
  const alertBreakdown = opts.alertBreakdown ?? false;
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'robustness-desc';
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
  const lensReports: Record<SlopeMadVsMaeLensName, Map<string, PerLensRaw>> = {
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
  for (const lens of SLOPE_MAD_VS_MAE_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_MAD_VS_MAE_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiMadVsMaeDivergenceRow[] = [];
  for (const s of sharedSources) {
    const mids: number[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_MAD_VS_MAE_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      mids.push((lo + hi) / 2);
    }
    const computed = madVsMaeDivergence(mids);
    rows.push({
      source: s,
      rowsKept,
      ...computed,
    });
  }

  const robustnessScores = rows.map((r) => r.robustnessScore);
  const meanRobustnessScore =
    robustnessScores.length > 0
      ? robustnessScores.reduce((a, b) => a + b, 0) / robustnessScores.length
      : 0;
  const medianRobustnessScore = median(robustnessScores);
  const finiteRatios = rows
    .filter((r) => Number.isFinite(r.divergenceRatio))
    .map((r) => r.divergenceRatio);
  const meanDivergenceRatio =
    finiteRatios.length > 0
      ? finiteRatios.reduce((a, b) => a + b, 0) / finiteRatios.length
      : 0;
  const nBreakdown = rows.filter((r) => r.breakdownFlag).length;
  const nInfiniteRatio = rows.filter(
    (r) => !Number.isFinite(r.divergenceRatio),
  ).length;

  let globalTailLens: SlopeMadVsMaeLensName | null = null;
  let globalSkewDirection: MadVsMaeSkewDirection | null = null;
  if (rows.length > 0) {
    const tailCounts = new Map<SlopeMadVsMaeLensName, number>();
    for (const lens of SLOPE_MAD_VS_MAE_LENS_NAMES) tailCounts.set(lens, 0);
    const skewCounts: Record<MadVsMaeSkewDirection, number> = {
      right: 0,
      left: 0,
      symmetric: 0,
    };
    for (const r of rows) {
      tailCounts.set(r.tailLens, tailCounts.get(r.tailLens)! + 1);
      skewCounts[r.skewDirection] += 1;
    }
    let maxC = -1;
    for (const lens of SLOPE_MAD_VS_MAE_LENS_NAMES) {
      const c = tailCounts.get(lens)!;
      if (c > maxC) {
        maxC = c;
        globalTailLens = lens;
      }
    }
    const skewOrder: MadVsMaeSkewDirection[] = ['right', 'left', 'symmetric'];
    let maxS = -1;
    for (const d of skewOrder) {
      if (skewCounts[d] > maxS) {
        maxS = skewCounts[d];
        globalSkewDirection = d;
      }
    }
  }

  let droppedAboveAlert = 0;
  let filtered = rows;
  if (alertDivergent !== null) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.robustnessScore < alertDivergent);
    droppedAboveAlert += before - filtered.length;
  }
  if (alertBreakdown) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.breakdownFlag);
    droppedAboveAlert += before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiMadVsMaeDivergenceRow,
      b: SourceRowTokenSlopeCiMadVsMaeDivergenceRow,
    ) => number
  > = {
    'robustness-desc': (a, b) => b.robustnessScore - a.robustnessScore,
    'robustness-asc': (a, b) => a.robustnessScore - b.robustnessScore,
    'divergence-ratio-desc': (a, b) => {
      // Infinity sorts first in desc.
      if (a.divergenceRatio === b.divergenceRatio) return 0;
      if (!Number.isFinite(a.divergenceRatio)) return -1;
      if (!Number.isFinite(b.divergenceRatio)) return 1;
      return b.divergenceRatio - a.divergenceRatio;
    },
    'divergence-ratio-asc': (a, b) => {
      if (a.divergenceRatio === b.divergenceRatio) return 0;
      if (!Number.isFinite(a.divergenceRatio)) return 1;
      if (!Number.isFinite(b.divergenceRatio)) return -1;
      return a.divergenceRatio - b.divergenceRatio;
    },
    'tail-deviation-desc': (a, b) => b.tailDeviation - a.tailDeviation,
    'tail-deviation-asc': (a, b) => a.tailDeviation - b.tailDeviation,
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
    alertDivergent,
    alertBreakdown,
    top,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    droppedAboveAlert,
    meanRobustnessScore,
    medianRobustnessScore,
    meanDivergenceRatio,
    nBreakdown,
    nInfiniteRatio,
    globalTailLens,
    globalSkewDirection,
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
 * appended after each source row naming the `tailLens`,
 * `tailDirection`, `divergenceRatio`, and an explicit
 * "(breakdown)" flag whenever `breakdownFlag` is true. Lighter-
 * weight alternative for surfacing just the tail-lens identity
 * and whether scale divergence crosses the 1.5 threshold.
 *
 * When `showBreakdownAggregate` is true, a single "[breakdown
 * aggregate]" line is appended AFTER the table summarizing the
 * fraction of sources that crossed the 1.5 threshold and the
 * dominant tail lens / skew direction. Quick at-a-glance one-
 * liner that doesn't require scanning the per-row table.
 */
export function renderSourceRowTokenSlopeCiMadVsMaeDivergence(
  r: SourceRowTokenSlopeCiMadVsMaeDivergenceReport,
  opts: { showSummary?: boolean; showBreakdownAggregate?: boolean } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showBreakdownAggregate = opts.showBreakdownAggregate ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-mad-vs-mae-divergence');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-divergent: ${r.alertDivergent ?? '-'}    alert-breakdown: ${r.alertBreakdown}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedAboveAlert} filtered-by-alert; meanRobustnessScore: ${fmtNum(r.meanRobustnessScore)}; medianRobustnessScore: ${fmtNum(r.medianRobustnessScore)}; meanDivergenceRatio: ${fmtNum(r.meanDivergenceRatio)}; nBreakdown: ${r.nBreakdown}; nInfiniteRatio: ${r.nInfiniteRatio}; globalTailLens: ${r.globalTailLens ?? '-'}; globalSkewDirection: ${r.globalSkewDirection ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  equalMid    medianMid   mae       madScaled  divRatio  tailLens           tailDev   tailDir  brk  skew       robust',
  );
  lines.push(
    '---------------  ----  ----------  ----------  --------  ---------  --------  -----------------  --------  -------  ---  ---------  --------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        fmtNum(row.equalMid).padStart(10),
        fmtNum(row.medianMid).padStart(10),
        fmtNum(row.mae).padStart(8),
        fmtNum(row.madScaled).padStart(9),
        fmtNum(row.divergenceRatio).padStart(8),
        row.tailLens.padEnd(17),
        fmtNum(row.tailDeviation).padStart(8),
        row.tailDirection.padEnd(7),
        (row.breakdownFlag ? 'yes' : 'no').padEnd(3),
        row.skewDirection.padEnd(9),
        fmtNum(row.robustnessScore).padStart(8),
      ].join('  '),
    );
    if (showSummary) {
      const arrow =
        row.tailDirection === 'up'
          ? '^'
          : row.tailDirection === 'down'
            ? 'v'
            : '=';
      const flag = row.breakdownFlag ? ' (breakdown)' : '';
      lines.push(
        `    summary: tail ${row.tailLens} ${arrow} dir=${row.tailDirection} divRatio=${fmtNum(row.divergenceRatio)}${flag}`,
      );
    }
  }
  if (showBreakdownAggregate && r.rows.length > 0) {
    const frac = r.nBreakdown / r.rows.length;
    lines.push(
      `[breakdown aggregate] ${r.nBreakdown}/${r.rows.length} sources crossed divRatio>1.5 (${fmtNum(frac, 4)}); globalTailLens=${r.globalTailLens ?? '-'}; globalSkewDirection=${r.globalSkewDirection ?? '-'}; nInfiniteRatio=${r.nInfiniteRatio}`,
    );
  }
  return lines.join('\n');
}
