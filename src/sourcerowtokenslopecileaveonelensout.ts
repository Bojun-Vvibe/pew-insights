/**
 * source-row-token-slope-ci-leave-one-lens-out
 *
 * Per-source LEAVE-ONE-LENS-OUT (LOO) influence diagnostic for the
 * v0.6.219 Deming-slope uncertainty-quantification suite. Consumes
 * the SAME six per-source slope CIs that the rest of the cross-lens
 * family consumes (v0.6.220 percentile bootstrap, v0.6.221 jackknife,
 * v0.6.222 BCa, v0.6.223 studentized-t, v0.6.224 ABC, v0.6.225
 * profile-likelihood).
 *
 * Mechanically distinct from ALL NINE prior cross-lens diagnostics
 * (v0.6.227 jaccard, v0.6.228 sign, v0.6.229 width, v0.6.230
 * overlap-graph, v0.6.231 midpoint-dispersion, v0.6.232 asymmetry,
 * v0.6.233 pair-inclusion, v0.6.234 rank-correlation, v0.6.235
 * coverage-volume) on a fundamental axis: it is the ONLY one that
 * is a SENSITIVITY axis. Every prior axis describes the JOINT
 * geometry of the six CIs as a static configuration (signs, widths,
 * overlaps, ranks). None of them answer the question "if we deleted
 * lens k, how much would the consensus midpoint move and how much
 * would the consensus width grow?" — i.e. how much each individual
 * lens INFLUENCES the consensus.
 *
 * The 10th axis is therefore the LEAVE-ONE-OUT INFLUENCE axis: a
 * classical jackknife-of-lenses applied to the 6-lens consensus.
 *
 * For each source we compute, on the 6 CI midpoints `mid_k =
 * (ciLower_k + ciUpper_k) / 2` and 6 widths `w_k = ciUpper_k -
 * ciLower_k`:
 *
 *   - `fullMid` = mean(mid_1..mid_6); `fullWidth` = mean(w_1..w_6);
 *     `fullMidStd` = sample std (n-1) of mid_1..mid_6.
 *
 *   For each lens k in [bootstrap, jackknife, bca, studentizedT,
 *   abc, profileLikelihood] (so 6 LOO rows per source):
 *
 *     - `looMid` = mean of the OTHER FIVE midpoints;
 *     - `looWidth` = mean of the OTHER FIVE widths;
 *     - `midShift` = `|looMid - fullMid|` (raw influence on center);
 *     - `signedMidShift` = `looMid - fullMid` (positive = removing
 *       lens k pulls the consensus midpoint UP, i.e. lens k was
 *       dragging it down);
 *     - `widthShift` = `looWidth - fullWidth` (signed; positive =
 *       removing k makes consensus WIDER, meaning k was the most
 *       precise lens);
 *     - `widthRatio` = `looWidth / fullWidth` (1 = no effect, > 1 =
 *       k was tighter than average, < 1 = k was wider than average);
 *     - `midShiftStd` = `midShift / fullWidth` (midpoint shift in
 *       units of the average CI width — unitless, comparable across
 *       sources with very different absolute slope magnitudes;
 *       returns 0 when `fullWidth == 0`).
 *
 *   Per-source aggregates:
 *
 *     - `mostInfluentialLens` — lens with the LARGEST `midShiftStd`
 *       (i.e. the lens whose removal moves the consensus midpoint
 *       most, in width-normalized units). Ties broken in canonical
 *       lens order.
 *     - `leastInfluentialLens` — lens with the SMALLEST
 *       `midShiftStd`. Ties broken in canonical lens order.
 *     - `tightestLens` — lens with the LARGEST `widthRatio`
 *       (removing it INFLATES the consensus width the most,
 *       meaning it was the tightest contributor). Ties broken in
 *       canonical lens order.
 *     - `widestLens` — lens with the SMALLEST `widthRatio`
 *       (removing it SHRINKS the consensus width the most). Ties
 *       broken in canonical lens order.
 *     - `maxMidShiftStd` = `max_k midShiftStd_k`;
 *     - `meanMidShiftStd` = `mean_k midShiftStd_k`;
 *     - `looStabilityScore` = `1 / (1 + maxMidShiftStd)` in (0, 1];
 *       1.0 = removing any single lens leaves the consensus
 *       midpoint exactly where it was (perfect stability); values
 *       near 0 mean at least one lens dominates the consensus.
 *       Default sort key.
 *     - `widthRatioRange` = `max widthRatio - min widthRatio`;
 *       large = lenses disagree wildly on precision.
 *
 *   Report-level aggregates:
 *
 *     - `meanLooStability` / `medianLooStability` — across all
 *       sources;
 *     - `globalMostInfluentialLens` — the lens that appears as
 *       `mostInfluentialLens` for the LARGEST number of sources;
 *     - `globalLeastInfluentialLens` — likewise for least
 *       influential.
 *
 * `--alert-unstable <f>` filters to sources whose `looStabilityScore`
 * is strictly less than f (in (0, 1]).
 *
 * Edge cases:
 *   - Source dropped from any of the six lenses → not reported
 *     (counted in `droppedMissingLens`).
 *   - `fullWidth == 0` (all six CIs are degenerate point intervals) →
 *     `midShiftStd` is 0 by convention (NOT NaN); `widthRatio` is
 *     1 by convention.
 *   - All six midpoints identical → every `midShift` and
 *     `signedMidShift` is 0; `looStabilityScore` = 1.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LOO_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLooLensName = (typeof SLOPE_LOO_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_LOO_LENS_NAMES.length;

export interface SourceRowTokenSlopeCiLeaveOneLensOutOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertUnstable?: number | null;
  top?: number | null;
  sort?:
    | 'stability-desc'
    | 'stability-asc'
    | 'max-mid-shift-std-desc'
    | 'max-mid-shift-std-asc'
    | 'mean-mid-shift-std-desc'
    | 'width-ratio-range-desc'
    | 'width-ratio-range-asc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SlopeLooRow {
  lensRemoved: SlopeLooLensName;
  looMid: number;
  looWidth: number;
  midShift: number;
  signedMidShift: number;
  widthShift: number;
  widthRatio: number;
  midShiftStd: number;
}

export interface SourceRowTokenSlopeCiLeaveOneLensOutRow {
  source: string;
  rowsKept: number;
  fullMid: number;
  fullWidth: number;
  fullMidStd: number;
  loo: SlopeLooRow[];
  mostInfluentialLens: SlopeLooLensName;
  /**
   * `signedMidShift` of the LOO row whose `midShift` defines
   * `maxMidShiftStd`. Positive = removing the most-influential
   * lens pulls the consensus midpoint UP (so that lens was
   * dragging the consensus down on the slope axis); negative =
   * the opposite. (Refinement field.)
   */
  mostInfluentialSignedShift: number;
  /**
   * Direction label derived from `mostInfluentialSignedShift`:
   * `'up'` if > 0 (removing the dominant lens raises the
   * consensus), `'down'` if < 0, `'neutral'` if exactly 0
   * (degenerate case, identical midpoints). (Refinement field.)
   */
  mostInfluentialDirection: 'up' | 'down' | 'neutral';
  leastInfluentialLens: SlopeLooLensName;
  tightestLens: SlopeLooLensName;
  widestLens: SlopeLooLensName;
  maxMidShiftStd: number;
  meanMidShiftStd: number;
  widthRatioRange: number;
  looStabilityScore: number;
}

export interface SourceRowTokenSlopeCiLeaveOneLensOutReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertUnstable: number | null;
  top: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiLeaveOneLensOutOptions['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedAboveAlert: number;
  meanLooStability: number;
  medianLooStability: number;
  globalMostInfluentialLens: SlopeLooLensName | null;
  globalLeastInfluentialLens: SlopeLooLensName | null;
  rows: SourceRowTokenSlopeCiLeaveOneLensOutRow[];
}

const VALID_SORTS = [
  'stability-desc',
  'stability-asc',
  'max-mid-shift-std-desc',
  'max-mid-shift-std-asc',
  'mean-mid-shift-std-desc',
  'width-ratio-range-desc',
  'width-ratio-range-asc',
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

function sampleStd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const n = xs.length;
  let s = 0;
  for (const x of xs) s += x;
  const m = s / n;
  let v = 0;
  for (const x of xs) {
    const d = x - m;
    v += d * d;
  }
  return Math.sqrt(v / (n - 1));
}

/**
 * Pure helper: given 6 midpoints and 6 widths in canonical lens
 * order, compute the 6-row LOO table plus aggregates. Exposed for
 * direct unit-testing.
 */
export function leaveOneLensOut(
  mids: number[],
  widths: number[],
): {
  fullMid: number;
  fullWidth: number;
  fullMidStd: number;
  loo: SlopeLooRow[];
  mostInfluentialLens: SlopeLooLensName;
  mostInfluentialSignedShift: number;
  mostInfluentialDirection: 'up' | 'down' | 'neutral';
  leastInfluentialLens: SlopeLooLensName;
  tightestLens: SlopeLooLensName;
  widestLens: SlopeLooLensName;
  maxMidShiftStd: number;
  meanMidShiftStd: number;
  widthRatioRange: number;
  looStabilityScore: number;
} {
  if (mids.length !== N_LENSES || widths.length !== N_LENSES) {
    throw new Error(
      `leaveOneLensOut: expected ${N_LENSES} midpoints and widths (got mids=${mids.length}, widths=${widths.length})`,
    );
  }
  let sumMid = 0;
  let sumWidth = 0;
  for (let i = 0; i < N_LENSES; i++) {
    sumMid += mids[i]!;
    sumWidth += widths[i]!;
  }
  const fullMid = sumMid / N_LENSES;
  const fullWidth = sumWidth / N_LENSES;
  const fullMidStd = sampleStd(mids);

  const loo: SlopeLooRow[] = [];
  for (let k = 0; k < N_LENSES; k++) {
    const looMid = (sumMid - mids[k]!) / (N_LENSES - 1);
    const looWidth = (sumWidth - widths[k]!) / (N_LENSES - 1);
    const signedMidShift = looMid - fullMid;
    const midShift = Math.abs(signedMidShift);
    const widthShift = looWidth - fullWidth;
    const widthRatio = fullWidth === 0 ? 1 : looWidth / fullWidth;
    const midShiftStd = fullWidth === 0 ? 0 : midShift / fullWidth;
    loo.push({
      lensRemoved: SLOPE_LOO_LENS_NAMES[k]!,
      looMid,
      looWidth,
      midShift,
      signedMidShift,
      widthShift,
      widthRatio,
      midShiftStd,
    });
  }

  let maxMSS = -Infinity;
  let minMSS = Infinity;
  let maxWR = -Infinity;
  let minWR = Infinity;
  let mostIdx = 0;
  let leastIdx = 0;
  let tightestIdx = 0;
  let widestIdx = 0;
  let sumMSS = 0;
  for (let k = 0; k < N_LENSES; k++) {
    const mss = loo[k]!.midShiftStd;
    sumMSS += mss;
    if (mss > maxMSS) {
      maxMSS = mss;
      mostIdx = k;
    }
    if (mss < minMSS) {
      minMSS = mss;
      leastIdx = k;
    }
    const wr = loo[k]!.widthRatio;
    if (wr > maxWR) {
      maxWR = wr;
      tightestIdx = k;
    }
    if (wr < minWR) {
      minWR = wr;
      widestIdx = k;
    }
  }
  const meanMSS = sumMSS / N_LENSES;
  const widthRatioRange = maxWR - minWR;
  const looStabilityScore = 1 / (1 + maxMSS);

  const mostInfluentialSignedShift = loo[mostIdx]!.signedMidShift;
  let mostInfluentialDirection: 'up' | 'down' | 'neutral';
  if (mostInfluentialSignedShift > 0) mostInfluentialDirection = 'up';
  else if (mostInfluentialSignedShift < 0) mostInfluentialDirection = 'down';
  else mostInfluentialDirection = 'neutral';

  return {
    fullMid,
    fullWidth,
    fullMidStd,
    loo,
    mostInfluentialLens: SLOPE_LOO_LENS_NAMES[mostIdx]!,
    mostInfluentialSignedShift,
    mostInfluentialDirection,
    leastInfluentialLens: SLOPE_LOO_LENS_NAMES[leastIdx]!,
    tightestLens: SLOPE_LOO_LENS_NAMES[tightestIdx]!,
    widestLens: SLOPE_LOO_LENS_NAMES[widestIdx]!,
    maxMidShiftStd: maxMSS,
    meanMidShiftStd: meanMSS,
    widthRatioRange,
    looStabilityScore,
  };
}

export function buildSourceRowTokenSlopeCiLeaveOneLensOut(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLeaveOneLensOutOptions = {},
): SourceRowTokenSlopeCiLeaveOneLensOutReport {
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
  const alertUnstable = opts.alertUnstable ?? null;
  if (alertUnstable !== null) {
    if (!Number.isFinite(alertUnstable) || alertUnstable <= 0 || alertUnstable > 1) {
      throw new Error(
        `alertUnstable must be a finite number in (0, 1] (got ${opts.alertUnstable})`,
      );
    }
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'stability-desc';
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
  const lensReports: Record<SlopeLooLensName, Map<string, PerLensRaw>> = {
    bootstrap: new Map(bootstrapReport.sources.map((r) => [r.source, r])),
    jackknife: new Map(jackknifeReport.sources.map((r) => [r.source, r])),
    bca: new Map(bcaReport.sources.map((r) => [r.source, r])),
    studentizedT: new Map(studReport.sources.map((r) => [r.source, r])),
    abc: new Map(abcReport.sources.map((r) => [r.source, r])),
    profileLikelihood: new Map(profileReport.sources.map((r) => [r.source, r])),
  };

  const allSources = new Set<string>();
  for (const lens of SLOPE_LOO_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LOO_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLeaveOneLensOutRow[] = [];
  for (const s of sharedSources) {
    const mids: number[] = [];
    const widths: number[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_LOO_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      mids.push((lo + hi) / 2);
      widths.push(hi - lo);
    }
    const computed = leaveOneLensOut(mids, widths);
    rows.push({
      source: s,
      rowsKept,
      ...computed,
    });
  }

  // Aggregates
  const stabilities = rows.map((r) => r.looStabilityScore);
  const meanLooStability =
    stabilities.length > 0
      ? stabilities.reduce((a, b) => a + b, 0) / stabilities.length
      : 0;
  const medianLooStability = median(stabilities);

  let globalMostInfluentialLens: SlopeLooLensName | null = null;
  let globalLeastInfluentialLens: SlopeLooLensName | null = null;
  if (rows.length > 0) {
    const mostCounts = new Map<SlopeLooLensName, number>();
    const leastCounts = new Map<SlopeLooLensName, number>();
    for (const lens of SLOPE_LOO_LENS_NAMES) {
      mostCounts.set(lens, 0);
      leastCounts.set(lens, 0);
    }
    for (const r of rows) {
      mostCounts.set(r.mostInfluentialLens, mostCounts.get(r.mostInfluentialLens)! + 1);
      leastCounts.set(
        r.leastInfluentialLens,
        leastCounts.get(r.leastInfluentialLens)! + 1,
      );
    }
    let mxM = -1;
    let mxL = -1;
    for (const lens of SLOPE_LOO_LENS_NAMES) {
      const cm = mostCounts.get(lens)!;
      if (cm > mxM) {
        mxM = cm;
        globalMostInfluentialLens = lens;
      }
      const cl = leastCounts.get(lens)!;
      if (cl > mxL) {
        mxL = cl;
        globalLeastInfluentialLens = lens;
      }
    }
  }

  let droppedAboveAlert = 0;
  let filtered = rows;
  if (alertUnstable !== null) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.looStabilityScore < alertUnstable);
    droppedAboveAlert = before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLeaveOneLensOutRow,
      b: SourceRowTokenSlopeCiLeaveOneLensOutRow,
    ) => number
  > = {
    'stability-desc': (a, b) => b.looStabilityScore - a.looStabilityScore,
    'stability-asc': (a, b) => a.looStabilityScore - b.looStabilityScore,
    'max-mid-shift-std-desc': (a, b) => b.maxMidShiftStd - a.maxMidShiftStd,
    'max-mid-shift-std-asc': (a, b) => a.maxMidShiftStd - b.maxMidShiftStd,
    'mean-mid-shift-std-desc': (a, b) => b.meanMidShiftStd - a.meanMidShiftStd,
    'width-ratio-range-desc': (a, b) => b.widthRatioRange - a.widthRatioRange,
    'width-ratio-range-asc': (a, b) => a.widthRatioRange - b.widthRatioRange,
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
    alertUnstable,
    top,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    droppedAboveAlert,
    meanLooStability,
    medianLooStability,
    globalMostInfluentialLens,
    globalLeastInfluentialLens,
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
 * When `showLoo` is true, the report is followed by a per-source
 * 6-row LOO sub-table (one row per removed lens) showing
 * lensRemoved, looMid, looWidth, midShift, widthRatio,
 * midShiftStd. Useful for full attribution; the default summary
 * row only names mostInfluential / leastInfluential.
 *
 * When `showDirection` is true, a compact one-line directional
 * summary is appended after each source row naming the
 * `mostInfluentialLens`, the `mostInfluentialDirection`
 * (`up`/`down`/`neutral`), and the raw `mostInfluentialSignedShift`
 * value. Lighter-weight alternative to `--show-loo` that surfaces
 * just the dominant lens's directional pull on the consensus.
 */
export function renderSourceRowTokenSlopeCiLeaveOneLensOut(
  r: SourceRowTokenSlopeCiLeaveOneLensOutReport,
  opts: { showLoo?: boolean; showDirection?: boolean } = {},
): string {
  const showLoo = opts.showLoo ?? false;
  const showDirection = opts.showDirection ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-leave-one-lens-out');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-unstable: ${r.alertUnstable ?? '-'}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedAboveAlert} above-alert-threshold; meanLooStability: ${fmtNum(r.meanLooStability)}; medianLooStability: ${fmtNum(r.medianLooStability)}; globalMostInfluentialLens: ${r.globalMostInfluentialLens ?? '-'}; globalLeastInfluentialLens: ${r.globalLeastInfluentialLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  fullMid     fullWidth   fullMidStd  maxMSS    meanMSS   wrRange   stability  mostInf            leastInf           tightest           widest',
  );
  lines.push(
    '---------------  ----  ----------  ----------  ----------  --------  --------  --------  ---------  -----------------  -----------------  -----------------  -----------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        fmtNum(row.fullMid).padStart(10),
        fmtNum(row.fullWidth).padStart(10),
        fmtNum(row.fullMidStd).padStart(10),
        fmtNum(row.maxMidShiftStd).padStart(8),
        fmtNum(row.meanMidShiftStd).padStart(8),
        fmtNum(row.widthRatioRange).padStart(8),
        fmtNum(row.looStabilityScore).padStart(9),
        row.mostInfluentialLens.padEnd(17),
        row.leastInfluentialLens.padEnd(17),
        row.tightestLens.padEnd(17),
        row.widestLens.padEnd(17),
      ].join('  '),
    );
    if (showDirection) {
      const arrow =
        row.mostInfluentialDirection === 'up'
          ? '^'
          : row.mostInfluentialDirection === 'down'
            ? 'v'
            : '=';
      lines.push(
        `    direction: removing ${row.mostInfluentialLens} pulls consensus midpoint ${row.mostInfluentialDirection} ${arrow} (signedShift=${fmtNum(row.mostInfluentialSignedShift)})`,
      );
    }
    if (showLoo) {
      lines.push(
        '    lensRemoved        looMid      looWidth    midShift    widthRatio  midShiftStd',
      );
      for (const l of row.loo) {
        lines.push(
          [
            '   ',
            l.lensRemoved.padEnd(17),
            fmtNum(l.looMid).padStart(10),
            fmtNum(l.looWidth).padStart(10),
            fmtNum(l.midShift).padStart(10),
            fmtNum(l.widthRatio).padStart(10),
            fmtNum(l.midShiftStd).padStart(11),
          ].join('  '),
        );
      }
    }
  }
  return lines.join('\n');
}
