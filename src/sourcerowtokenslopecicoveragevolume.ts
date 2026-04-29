/**
 * source-row-token-slope-ci-coverage-volume
 *
 * Per-source CI-COVERAGE-VOLUME diagnostic for the v0.6.219 Deming-
 * slope uncertainty-quantification suite. Consumes the SAME six per-
 * source slope CIs that the rest of the cross-lens family consumes:
 *
 *   1. percentile bootstrap     (v0.6.220)
 *   2. jackknife normal         (v0.6.221)
 *   3. BCa bootstrap            (v0.6.222)
 *   4. studentized-t bootstrap  (v0.6.223)
 *   5. ABC bootstrap            (v0.6.224)
 *   6. profile-likelihood       (v0.6.225)
 *
 * Mechanically distinct from ALL EIGHT prior cross-lens diagnostics
 * (v0.6.227 jaccard, v0.6.228 sign, v0.6.229 width, v0.6.230
 * overlap-graph, v0.6.231 midpoint-dispersion, v0.6.232 asymmetry-
 * shape, v0.6.233 pair-inclusion classification, v0.6.234 cross-
 * source rank-correlation) on a fundamental axis:
 *
 *   - v0.6.227 Jaccard reduces overlap to a {-1, 0, +1} sign-set
 *     intersection-over-union -- a SET-BASED calculation on the
 *     sign of the slope, NOT on the actual numeric extent of the
 *     CI interval. Two CIs whose signs agree get Jaccard = 1
 *     regardless of how thin or fat the actual interval overlap is.
 *   - v0.6.230 overlap-graph collapses each pair to a SINGLE BIT
 *     (overlap or disjoint) and from there builds a graph; loses
 *     all magnitude information about HOW MUCH the intervals
 *     overlap.
 *   - v0.6.233 pair-inclusion classifies each pair into one of
 *     FIVE CATEGORICAL buckets (EQ/A_IN_B/B_IN_A/PARTIAL/DISJOINT);
 *     two PARTIAL pairs with wildly different overlap volumes get
 *     the same label.
 *   - v0.6.229 width-concordance compares CI WIDTHS in isolation;
 *     it never measures pair-wise interval intersection at all.
 *   - v0.6.231 midpoint-dispersion measures CENTER spread; two CIs
 *     centered identically can have any overlap volume from 0 (one
 *     is a single point, the other is degenerate) to 1 (identical
 *     intervals); midpoints alone don't say.
 *   - v0.6.232 asymmetry measures shape AROUND the point estimate
 *     INSIDE a single CI; says nothing pairwise.
 *   - v0.6.228 sign concordance is per-source on slope sign only.
 *   - v0.6.234 rank-correlation is the only CROSS-SOURCE axis; it
 *     never looks at a single source's CI interval geometry.
 *
 *   The 9th axis is therefore the CONTINUOUS COVERAGE-VOLUME axis:
 *   for each pair of CIs we compute the actual Lebesgue (length)
 *   intersection-over-union of the intervals, plus a containment-
 *   normalized variant. This surfaces "the lenses technically agree
 *   on signs and overlap, but only by a hair" and "the lenses
 *   nominally PARTIAL-overlap but actually share 99% of their
 *   length" -- gradations that none of the 8 prior axes resolve.
 *
 *   For each of the C(6,2) = 15 lens pairs (per source) we compute:
 *
 *     - `iou` -- |A INTERSECT B| / |A UNION B| in [0, 1]. The
 *       headline coverage volume metric. 1 means identical
 *       intervals; 0 means disjoint OR one of A, B has zero length
 *       and is not contained in the other;
 *     - `overlap` -- raw |A INTERSECT B| length, >= 0;
 *     - `union` -- raw |A UNION B| length, >= 0 (equals
 *       |A| + |B| - |A INTERSECT B| when intervals overlap, or
 *       |A| + |B| + gap when disjoint -- the LATTER follows the
 *       outer-hull convention so that union-length is always
 *       monotone in interval separation, which makes 1 - iou a
 *       proper distance);
 *     - `containmentRatio` -- |A INTERSECT B| / min(|A|, |B|) in
 *       [0, 1]. 1 means the SMALLER interval is fully covered by
 *       the larger. Distinguishes "tightly nested" (containment=1,
 *       iou < 1) from "side-by-side overlap" (containment < 1,
 *       iou < 1).
 *
 * Per source we report:
 *
 *   - `pairs` -- 15-vector of `{ iou, overlap, union, containmentRatio }`
 *     in canonical pair order (`i < j` over canonical lens order:
 *     bootstrap, jackknife, bca, studentizedT, abc, profileLikelihood);
 *   - `meanIou`, `medianIou`, `minIou`, `maxIou` -- across the 15
 *     pairs;
 *   - `meanContainment`, `minContainment`, `maxContainment` --
 *     across the 15 pairs;
 *   - `iouSpread` -- `maxIou - minIou` in [0, 1]; large spread
 *     means some pairs agree tightly and others barely;
 *   - `weakPairs` -- count of pairs whose `iou < 0.5` (default
 *     threshold; configurable via the renderer / aggregator);
 *   - `strongPairs` -- count of pairs whose `iou >= 0.9`;
 *   - `disjointPairs` -- count of pairs whose `overlap == 0`;
 *   - `meanWidth` -- mean of the 6 CI widths, surfaced for
 *     interpretation (an iou of 0.95 over very narrow CIs is
 *     stronger evidence of agreement than 0.95 over very wide
 *     ones);
 *   - `coherenceScore` -- `meanIou * (1 - disjointPairs/15)` in
 *     [0, 1]: rewards both high mean overlap volume AND no
 *     outright disjoint pairs. Default sort key.
 *
 * Report-level:
 *
 *   - aggregate counts of disjoint-pair sources, weak-mean-iou
 *     sources (`meanIou < 0.5`), and strong-mean-iou sources
 *     (`meanIou >= 0.9`);
 *   - global `meanCoherenceScore` across kept sources.
 *
 * IoU convention for disjoint intervals: when [aLo, aHi] and
 * [bLo, bHi] are disjoint, |A INTERSECT B| = 0 and
 * |A UNION B| = (max(aHi, bHi) - min(aLo, bLo)) -- the OUTER HULL
 * length, not the sum of the two interval lengths plus a gap as a
 * disjoint set-measure. This convention makes `1 - iou` a proper
 * pseudo-distance (it grows as the intervals separate) and matches
 * the geometric "how much of the relevant range do the two
 * intervals jointly cover" intuition that downstream users want.
 * It also keeps the metric in [0, 1] without truncation.
 *
 * Degenerate-interval convention: when |A| == 0 (a point CI) and
 * the point lies inside B, `iou = 0` (because |union| = |B| > 0
 * and |intersection| = 0); when both |A| == |B| == 0 and the
 * points coincide, `iou = 1` by convention (identical zero-length
 * intervals); when both are zero-length but distinct, `iou = 0`.
 * `containmentRatio` is `1` when the zero-length point lies in the
 * other interval, `0` otherwise. These conventions are tested.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_COVERAGE_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeCoverageLensName = (typeof SLOPE_COVERAGE_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_COVERAGE_LENS_NAMES.length;
const N_PAIRS = (N_LENSES * (N_LENSES - 1)) / 2; // 15

export interface CoverageVolumePair {
  iou: number;
  overlap: number;
  union: number;
  containmentRatio: number;
}

/**
 * Compute IoU + raw overlap + outer-hull union + containment ratio
 * for two intervals [aLo, aHi] and [bLo, bHi]. Endpoints must be
 * finite and lo <= hi. See module docstring for the disjoint-and-
 * degenerate conventions.
 */
export function coveragePair(
  aLo: number,
  aHi: number,
  bLo: number,
  bHi: number,
): CoverageVolumePair {
  for (const v of [aLo, aHi, bLo, bHi]) {
    if (!Number.isFinite(v)) {
      throw new Error(`coveragePair: non-finite endpoint (${v})`);
    }
  }
  if (aLo > aHi) {
    throw new Error(`coveragePair: A is ill-formed (aLo=${aLo} > aHi=${aHi})`);
  }
  if (bLo > bHi) {
    throw new Error(`coveragePair: B is ill-formed (bLo=${bLo} > bHi=${bHi})`);
  }
  const aLen = aHi - aLo;
  const bLen = bHi - bLo;
  const interLo = Math.max(aLo, bLo);
  const interHi = Math.min(aHi, bHi);
  const overlap = interHi >= interLo ? interHi - interLo : 0;
  const unionHullLo = Math.min(aLo, bLo);
  const unionHullHi = Math.max(aHi, bHi);
  const unionLen = unionHullHi - unionHullLo;

  // IoU
  let iou: number;
  if (unionLen === 0) {
    // Both intervals are zero-length AND coincide at the same point
    iou = 1;
  } else {
    iou = overlap / unionLen;
  }
  if (iou < 0) iou = 0;
  if (iou > 1) iou = 1;

  // Containment ratio
  let containmentRatio: number;
  const minLen = Math.min(aLen, bLen);
  if (minLen === 0) {
    // The shorter interval is a point. Containment is 1 iff that
    // point lies (inclusively) inside the other interval.
    if (aLen === 0 && bLen === 0) {
      containmentRatio = aLo === bLo ? 1 : 0;
    } else if (aLen === 0) {
      containmentRatio = aLo >= bLo && aLo <= bHi ? 1 : 0;
    } else {
      containmentRatio = bLo >= aLo && bLo <= aHi ? 1 : 0;
    }
  } else {
    containmentRatio = overlap / minLen;
    if (containmentRatio < 0) containmentRatio = 0;
    if (containmentRatio > 1) containmentRatio = 1;
  }

  return { iou, overlap, union: unionLen, containmentRatio };
}

export interface SourceRowTokenSlopeCiCoverageVolumeOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  weakIouThreshold?: number;
  strongIouThreshold?: number;
  alertWeakMean?: number | null;
  top?: number | null;
  sort?:
    | 'coherence-desc'
    | 'coherence-asc'
    | 'mean-iou-desc'
    | 'mean-iou-asc'
    | 'median-iou-desc'
    | 'min-iou-desc'
    | 'min-iou-asc'
    | 'max-iou-desc'
    | 'iou-spread-desc'
    | 'iou-spread-asc'
    | 'weak-pairs-desc'
    | 'strong-pairs-desc'
    | 'disjoint-pairs-desc'
    | 'mean-containment-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiCoverageVolumeRow {
  source: string;
  rowsKept: number;
  pairs: CoverageVolumePair[];
  meanIou: number;
  medianIou: number;
  minIou: number;
  maxIou: number;
  iouSpread: number;
  meanContainment: number;
  minContainment: number;
  maxContainment: number;
  weakPairs: number;
  strongPairs: number;
  disjointPairs: number;
  meanWidth: number;
  coherenceScore: number;
}

export interface SourceRowTokenSlopeCiCoverageVolumeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  weakIouThreshold: number;
  strongIouThreshold: number;
  alertWeakMean: number | null;
  top: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiCoverageVolumeOptions['sort']>;
  totalSources: number;
  totalRowsKept: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedAboveAlert: number;
  droppedBelowTopCap: number;
  weakMeanIouCount: number;
  strongMeanIouCount: number;
  anyDisjointCount: number;
  meanCoherenceScore: number;
  sources: SourceRowTokenSlopeCiCoverageVolumeRow[];
}

const VALID_SORTS = [
  'coherence-desc',
  'coherence-asc',
  'mean-iou-desc',
  'mean-iou-asc',
  'median-iou-desc',
  'min-iou-desc',
  'min-iou-asc',
  'max-iou-desc',
  'iou-spread-desc',
  'iou-spread-asc',
  'weak-pairs-desc',
  'strong-pairs-desc',
  'disjoint-pairs-desc',
  'mean-containment-desc',
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

export function buildSourceRowTokenSlopeCiCoverageVolume(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiCoverageVolumeOptions = {},
): SourceRowTokenSlopeCiCoverageVolumeReport {
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
  const weakIouThreshold = opts.weakIouThreshold ?? 0.5;
  if (
    !Number.isFinite(weakIouThreshold) ||
    weakIouThreshold < 0 ||
    weakIouThreshold > 1
  ) {
    throw new Error(
      `weakIouThreshold must be a finite number in [0, 1] (got ${opts.weakIouThreshold})`,
    );
  }
  const strongIouThreshold = opts.strongIouThreshold ?? 0.9;
  if (
    !Number.isFinite(strongIouThreshold) ||
    strongIouThreshold < 0 ||
    strongIouThreshold > 1
  ) {
    throw new Error(
      `strongIouThreshold must be a finite number in [0, 1] (got ${opts.strongIouThreshold})`,
    );
  }
  if (strongIouThreshold < weakIouThreshold) {
    throw new Error(
      `strongIouThreshold (${strongIouThreshold}) must be >= weakIouThreshold (${weakIouThreshold})`,
    );
  }
  const alertWeakMean = opts.alertWeakMean ?? null;
  if (alertWeakMean !== null) {
    if (
      !Number.isFinite(alertWeakMean) ||
      alertWeakMean < 0 ||
      alertWeakMean > 1
    ) {
      throw new Error(
        `alertWeakMean must be a finite number in [0, 1] (got ${opts.alertWeakMean})`,
      );
    }
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'coherence-desc';
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
  const lensReports: Record<SlopeCoverageLensName, Map<string, PerLensRaw>> = {
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
  for (const lens of SLOPE_COVERAGE_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_COVERAGE_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }

  const rows: SourceRowTokenSlopeCiCoverageVolumeRow[] = [];

  for (const s of sharedSources) {
    const intervals: { lo: number; hi: number }[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_COVERAGE_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      intervals.push({ lo, hi });
    }

    const pairs: CoverageVolumePair[] = [];
    for (let i = 0; i < N_LENSES; i++) {
      for (let j = i + 1; j < N_LENSES; j++) {
        pairs.push(
          coveragePair(
            intervals[i]!.lo,
            intervals[i]!.hi,
            intervals[j]!.lo,
            intervals[j]!.hi,
          ),
        );
      }
    }

    const ious = pairs.map((p) => p.iou);
    const containments = pairs.map((p) => p.containmentRatio);
    let sumIou = 0;
    let mnIou = Infinity;
    let mxIou = -Infinity;
    let weakPairs = 0;
    let strongPairs = 0;
    let disjointPairs = 0;
    for (const p of pairs) {
      sumIou += p.iou;
      if (p.iou < mnIou) mnIou = p.iou;
      if (p.iou > mxIou) mxIou = p.iou;
      if (p.iou < weakIouThreshold) weakPairs += 1;
      if (p.iou >= strongIouThreshold) strongPairs += 1;
      if (p.overlap === 0) disjointPairs += 1;
    }
    const meanIou = sumIou / N_PAIRS;
    const medianIou = median(ious);
    const iouSpread = mxIou - mnIou;

    let sumC = 0;
    let mnC = Infinity;
    let mxC = -Infinity;
    for (const c of containments) {
      sumC += c;
      if (c < mnC) mnC = c;
      if (c > mxC) mxC = c;
    }
    const meanContainment = sumC / N_PAIRS;
    const minContainment = mnC;
    const maxContainment = mxC;

    let sumWidth = 0;
    for (const iv of intervals) sumWidth += iv.hi - iv.lo;
    const meanWidth = sumWidth / N_LENSES;

    const coherenceScore = meanIou * (1 - disjointPairs / N_PAIRS);

    rows.push({
      source: s,
      rowsKept,
      pairs,
      meanIou,
      medianIou,
      minIou: mnIou,
      maxIou: mxIou,
      iouSpread,
      meanContainment,
      minContainment,
      maxContainment,
      weakPairs,
      strongPairs,
      disjointPairs,
      meanWidth,
      coherenceScore,
    });
  }

  const weakMeanIouCount = rows.filter((r) => r.meanIou < weakIouThreshold)
    .length;
  const strongMeanIouCount = rows.filter(
    (r) => r.meanIou >= strongIouThreshold,
  ).length;
  const anyDisjointCount = rows.filter((r) => r.disjointPairs > 0).length;
  const meanCoherenceScore =
    rows.length > 0
      ? rows.reduce((acc, r) => acc + r.coherenceScore, 0) / rows.length
      : 0;

  let filtered = rows;
  let droppedAboveAlert = 0;
  if (alertWeakMean !== null) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.meanIou < alertWeakMean);
    droppedAboveAlert = before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiCoverageVolumeRow,
      b: SourceRowTokenSlopeCiCoverageVolumeRow,
    ) => number
  > = {
    'coherence-desc': (a, b) => b.coherenceScore - a.coherenceScore,
    'coherence-asc': (a, b) => a.coherenceScore - b.coherenceScore,
    'mean-iou-desc': (a, b) => b.meanIou - a.meanIou,
    'mean-iou-asc': (a, b) => a.meanIou - b.meanIou,
    'median-iou-desc': (a, b) => b.medianIou - a.medianIou,
    'min-iou-desc': (a, b) => b.minIou - a.minIou,
    'min-iou-asc': (a, b) => a.minIou - b.minIou,
    'max-iou-desc': (a, b) => b.maxIou - a.maxIou,
    'iou-spread-desc': (a, b) => b.iouSpread - a.iouSpread,
    'iou-spread-asc': (a, b) => a.iouSpread - b.iouSpread,
    'weak-pairs-desc': (a, b) => b.weakPairs - a.weakPairs,
    'strong-pairs-desc': (a, b) => b.strongPairs - a.strongPairs,
    'disjoint-pairs-desc': (a, b) => b.disjointPairs - a.disjointPairs,
    'mean-containment-desc': (a, b) => b.meanContainment - a.meanContainment,
    rows: (a, b) => b.rowsKept - a.rowsKept,
    source: (a, b) => a.source.localeCompare(b.source),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return a.source.localeCompare(b.source);
  });

  let droppedBelowTopCap = 0;
  if (top !== null && filtered.length > top) {
    droppedBelowTopCap = filtered.length - top;
    filtered = filtered.slice(0, top);
  }

  const totalRowsKept = rows.reduce((acc, r) => acc + r.rowsKept, 0);

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
    weakIouThreshold,
    strongIouThreshold,
    alertWeakMean,
    top,
    sort,
    totalSources: rows.length + droppedMissingLens,
    totalRowsKept,
    sourcesWithAllLenses: rows.length,
    droppedMissingLens,
    droppedAboveAlert,
    droppedBelowTopCap,
    weakMeanIouCount,
    strongMeanIouCount,
    anyDisjointCount,
    meanCoherenceScore,
    sources: filtered,
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
 * When `showPairs` is true, each source row is followed by a
 * second line printing the canonical 15-vector of `iou` values in
 * `i<j` order over canonical lens order. Useful for spotting the
 * specific lens pair that drives `minIou` or `iouSpread`.
 */
export function renderSourceRowTokenSlopeCiCoverageVolume(
  r: SourceRowTokenSlopeCiCoverageVolumeReport,
  opts: { showPairs?: boolean } = {},
): string {
  const showPairs = opts.showPairs ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-coverage-volume');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses}, shown ${r.sources.length})    rows: ${r.totalRowsKept}    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    weak-iou: ${r.weakIouThreshold}    strong-iou: ${r.strongIouThreshold}    alert-weak-mean: ${r.alertWeakMean ?? '-'}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedAboveAlert} above-alert-threshold, ${r.droppedBelowTopCap} below top cap; weak-mean-iou: ${r.weakMeanIouCount}; strong-mean-iou: ${r.strongMeanIouCount}; any-disjoint-pair: ${r.anyDisjointCount}; meanCoherenceScore: ${fmtNum(r.meanCoherenceScore)}`,
  );
  lines.push('');
  if (r.sources.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  meanIou  medIou   minIou   maxIou   spread   weak  strong  disj  meanCont  cohScore  meanWidth',
  );
  lines.push(
    '---------------  ----  -------  -------  -------  -------  -------  ----  ------  ----  --------  --------  ----------',
  );
  for (const row of r.sources) {
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        row.meanIou.toFixed(4).padStart(7),
        row.medianIou.toFixed(4).padStart(7),
        row.minIou.toFixed(4).padStart(7),
        row.maxIou.toFixed(4).padStart(7),
        row.iouSpread.toFixed(4).padStart(7),
        String(row.weakPairs).padStart(4),
        String(row.strongPairs).padStart(6),
        String(row.disjointPairs).padStart(4),
        row.meanContainment.toFixed(4).padStart(8),
        row.coherenceScore.toFixed(4).padStart(8),
        fmtNum(row.meanWidth).padStart(10),
      ].join('  '),
    );
    if (showPairs) {
      const parts: string[] = [];
      let k = 0;
      for (let i = 0; i < N_LENSES; i++) {
        for (let j = i + 1; j < N_LENSES; j++) {
          const li = SLOPE_COVERAGE_LENS_NAMES[i]!;
          const lj = SLOPE_COVERAGE_LENS_NAMES[j]!;
          parts.push(`${li}~${lj}=${row.pairs[k]!.iou.toFixed(3)}`);
          k += 1;
        }
      }
      lines.push(`                 iou: ${parts.join('  ')}`);
    }
  }
  return lines.join('\n');
}
