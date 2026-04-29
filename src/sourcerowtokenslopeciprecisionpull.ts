/**
 * source-row-token-slope-ci-precision-pull
 *
 * Per-source PRECISION-WEIGHTED vs EQUAL-WEIGHTED consensus shift
 * diagnostic for the v0.6.219 Deming-slope uncertainty-quantification
 * suite. Consumes the SAME six per-source slope CIs that the rest of
 * the cross-lens family consumes (v0.6.220 percentile bootstrap,
 * v0.6.221 jackknife normal, v0.6.222 BCa, v0.6.223 studentized-t,
 * v0.6.224 ABC, v0.6.225 profile-likelihood).
 *
 * Mechanically distinct from ALL TEN prior cross-lens diagnostics
 * (v0.6.227 jaccard, v0.6.228 sign, v0.6.229 width, v0.6.230
 * overlap-graph, v0.6.231 midpoint-dispersion, v0.6.232 asymmetry,
 * v0.6.233 pair-inclusion, v0.6.234 rank-correlation, v0.6.235
 * coverage-volume, v0.6.237 leave-one-lens-out) on a fundamental
 * axis: it is the only one that asks "how does the consensus midpoint
 * MOVE when we re-weight the six lenses by their PRECISION (1/width)
 * instead of treating them all equally?"
 *
 * Every prior axis treats the six lenses as exchangeable contributors
 * (equal-weight mean midpoint, equal-weight LOO, equal-weight ranks,
 * equal-weight overlap graph, etc.). v0.6.237 LOO drops one lens at
 * a time at FULL weight; this axis instead asks the dual question:
 * if we kept all six lenses but weighted each by its precision (so
 * tighter CIs count more), where would the consensus center go?
 *
 * For each source we compute on the 6 CI midpoints `mid_k = (lo_k +
 * hi_k) / 2` and 6 widths `w_k = hi_k - lo_k`:
 *
 *   - `equalMid` = arithmetic mean of mid_1..mid_6 (the v0.6.237
 *     `fullMid`);
 *   - `equalWidth` = arithmetic mean of w_1..w_6 (the v0.6.237
 *     `fullWidth`);
 *   - `precisionWeights` = `[1/w_1, ..., 1/w_6]`. When `w_k == 0`
 *     (degenerate point CI) the lens is INFINITELY precise. We
 *     handle this exactly: if any width is 0, the precision-weighted
 *     mean reduces to the unweighted mean of just the
 *     zero-width lenses' midpoints (i.e. they capture all the
 *     weight). If all six widths are 0 the precision-weighted mean
 *     equals the equal-weighted mean by convention.
 *   - `precisionMid` = sum_k(precisionWeights_k * mid_k) /
 *     sum_k(precisionWeights_k), with the zero-width branch above;
 *   - `signedPull` = `precisionMid - equalMid` (positive = tighter
 *     lenses are pulling consensus UP);
 *   - `pull` = `|signedPull|` (raw center-of-mass shift);
 *   - `pullStd` = `pull / equalWidth` when `equalWidth > 0`, else
 *     0 by convention (unitless, comparable across sources with
 *     wildly different absolute slope magnitudes — same
 *     normalization choice as v0.6.237 `midShiftStd`);
 *   - `pullDirection` = `'up' | 'down' | 'neutral'` derived from
 *     the sign of `signedPull`;
 *   - `weightShare_k` = `precisionWeights_k / sum_j precisionWeights_j`
 *     in [0, 1] for each lens (sums to 1 across the 6 lenses); when
 *     all widths are 0 every share is 1/6 by convention;
 *   - `weightGini` = the Gini coefficient of the 6 weight shares,
 *     in [0, 5/6] (max 5/6 when one lens has all the weight). 0 =
 *     all six lenses equally precise, large = one lens dominates;
 *   - `dominantLens` = the lens with the LARGEST weightShare (ties
 *     broken in canonical lens order);
 *   - `dominantWeightShare` = its share value in [0, 1];
 *   - `mostPrecisionPullingLens` = lens whose midpoint is FURTHEST
 *     from `equalMid` AMONG the lenses with above-average precision
 *     (i.e. weightShare > 1/6). When no lens has above-average
 *     precision (all six weights ~equal) this defaults to
 *     `dominantLens`.
 *
 * Per-source aggregates are: `pull`, `signedPull`, `pullStd`,
 * `pullDirection`, `weightGini`, `dominantLens`,
 * `dominantWeightShare`, `mostPrecisionPullingLens`.
 *
 * `precisionAlignmentScore` = `1 / (1 + pullStd)` in (0, 1] — the
 * default sort key. 1.0 = the precise lenses agree exactly with the
 * imprecise lenses on the consensus center (precision re-weighting
 * doesn't move it); near 0 = the precise lenses pull consensus
 * sharply away from the equal-weight center.
 *
 * Report-level aggregates:
 *
 *   - `meanPrecisionAlignment` / `medianPrecisionAlignment` — across
 *     all reported sources;
 *   - `meanWeightGini` — average concentration of precision across
 *     the lens set;
 *   - `globalDominantLens` — the lens that appears as `dominantLens`
 *     for the LARGEST number of sources (ties broken in canonical
 *     lens order);
 *   - `globalPullDirection` — the direction (`up`/`down`/`neutral`)
 *     that appears as `pullDirection` for the most sources (ties
 *     broken `up` > `down` > `neutral`).
 *
 * `--alert-misaligned <f>` filters to sources whose
 * `precisionAlignmentScore` is strictly less than f (in (0, 1]) —
 * i.e. the sources where precision re-weighting WOULD meaningfully
 * move consensus.
 *
 * Edge cases:
 *   - Source dropped from any of the six lenses → not reported
 *     (counted in `droppedMissingLens`).
 *   - All six widths == 0 → `precisionMid = equalMid` exactly,
 *     `pull = 0`, `pullStd = 0`, `precisionAlignmentScore = 1`,
 *     every weightShare = 1/6, `weightGini = 0`.
 *   - Some (but not all) widths == 0 → those zero-width lenses
 *     consume all the weight; `precisionMid` is the unweighted
 *     mean of their midpoints; remaining lenses get
 *     `weightShare = 0`.
 *   - All six midpoints identical → `pull = 0` regardless of
 *     widths; `precisionAlignmentScore = 1`.
 *
 * Why an 11th axis: every prior axis (including v0.6.237 LOO)
 * implicitly treats the six lenses as equal-weight contributors to
 * the consensus. But the lenses report DIFFERENT precisions: a
 * tight BCa CI and a loose profile-likelihood CI carry the same
 * vote in every prior axis. This axis is the ONLY one that asks
 * what consensus we'd report under inverse-variance pooling — the
 * standard meta-analytic weighting scheme — and quantifies how far
 * that pooled center is from the equal-weight center. A large
 * `pullStd` is the diagnostic signature that the precise lenses
 * and imprecise lenses literally disagree on the SLOPE itself
 * (not just on uncertainty), and the equal-weight consensus
 * conceals that disagreement.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_PRECISION_PULL_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopePrecisionPullLensName =
  (typeof SLOPE_PRECISION_PULL_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_PRECISION_PULL_LENS_NAMES.length;

export interface SourceRowTokenSlopeCiPrecisionPullOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertMisaligned?: number | null;
  top?: number | null;
  sort?:
    | 'alignment-desc'
    | 'alignment-asc'
    | 'pull-std-desc'
    | 'pull-std-asc'
    | 'weight-gini-desc'
    | 'weight-gini-asc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiPrecisionPullRow {
  source: string;
  rowsKept: number;
  equalMid: number;
  equalWidth: number;
  precisionMid: number;
  signedPull: number;
  pull: number;
  pullStd: number;
  pullDirection: 'up' | 'down' | 'neutral';
  weightShares: number[]; // length 6, canonical lens order, sums to 1
  weightGini: number;
  dominantLens: SlopePrecisionPullLensName;
  dominantWeightShare: number;
  mostPrecisionPullingLens: SlopePrecisionPullLensName;
  precisionAlignmentScore: number;
}

export interface SourceRowTokenSlopeCiPrecisionPullReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertMisaligned: number | null;
  top: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiPrecisionPullOptions['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedAboveAlert: number;
  meanPrecisionAlignment: number;
  medianPrecisionAlignment: number;
  meanWeightGini: number;
  globalDominantLens: SlopePrecisionPullLensName | null;
  globalPullDirection: 'up' | 'down' | 'neutral' | null;
  rows: SourceRowTokenSlopeCiPrecisionPullRow[];
}

const VALID_SORTS = [
  'alignment-desc',
  'alignment-asc',
  'pull-std-desc',
  'pull-std-asc',
  'weight-gini-desc',
  'weight-gini-asc',
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
 * Gini coefficient of a non-negative weight vector that sums to 1.
 * Uses the standard mean-absolute-difference formulation:
 *   G = sum_i sum_j |w_i - w_j| / (2 * n * sum_i w_i)
 * For a vector of size n that sums to 1, max G = (n-1)/n
 * (one lens has all the weight). Returns 0 when every entry is
 * 1/n. Exposed for direct unit-testing.
 */
export function giniOfWeights(ws: number[]): number {
  const n = ws.length;
  if (n === 0) return 0;
  let sum = 0;
  for (const w of ws) sum += w;
  if (sum <= 0) return 0;
  let absDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      absDiff += Math.abs(ws[i]! - ws[j]!);
    }
  }
  return absDiff / (2 * n * sum);
}

/**
 * Pure helper: given 6 midpoints and 6 widths in canonical lens
 * order, compute the precision-pull diagnostic for that source.
 * Exposed for direct unit-testing.
 */
export function precisionPull(
  mids: number[],
  widths: number[],
): {
  equalMid: number;
  equalWidth: number;
  precisionMid: number;
  signedPull: number;
  pull: number;
  pullStd: number;
  pullDirection: 'up' | 'down' | 'neutral';
  weightShares: number[];
  weightGini: number;
  dominantLens: SlopePrecisionPullLensName;
  dominantWeightShare: number;
  mostPrecisionPullingLens: SlopePrecisionPullLensName;
  precisionAlignmentScore: number;
} {
  if (mids.length !== N_LENSES || widths.length !== N_LENSES) {
    throw new Error(
      `precisionPull: expected ${N_LENSES} midpoints and widths (got mids=${mids.length}, widths=${widths.length})`,
    );
  }
  for (const w of widths) {
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(
        `precisionPull: widths must be finite and non-negative (got ${w})`,
      );
    }
  }

  let sumMid = 0;
  let sumWidth = 0;
  for (let i = 0; i < N_LENSES; i++) {
    sumMid += mids[i]!;
    sumWidth += widths[i]!;
  }
  const equalMid = sumMid / N_LENSES;
  const equalWidth = sumWidth / N_LENSES;

  // Compute weight shares with the zero-width branch.
  const zeroIdx: number[] = [];
  for (let i = 0; i < N_LENSES; i++) {
    if (widths[i]! === 0) zeroIdx.push(i);
  }
  const weightShares: number[] = new Array(N_LENSES).fill(0);
  let precisionMid: number;
  if (zeroIdx.length === N_LENSES) {
    // All zero-width: by convention equal weights.
    for (let i = 0; i < N_LENSES; i++) weightShares[i] = 1 / N_LENSES;
    precisionMid = equalMid;
  } else if (zeroIdx.length > 0) {
    // Some zero-width: those lenses absorb all the weight equally.
    const each = 1 / zeroIdx.length;
    let m = 0;
    for (const i of zeroIdx) {
      weightShares[i] = each;
      m += mids[i]!;
    }
    precisionMid = m / zeroIdx.length;
  } else {
    // All positive widths: standard inverse-variance / inverse-width pooling.
    const ws: number[] = new Array(N_LENSES);
    let totalW = 0;
    for (let i = 0; i < N_LENSES; i++) {
      const w = 1 / widths[i]!;
      ws[i] = w;
      totalW += w;
    }
    let weighted = 0;
    for (let i = 0; i < N_LENSES; i++) {
      const share = ws[i]! / totalW;
      weightShares[i] = share;
      weighted += share * mids[i]!;
    }
    precisionMid = weighted;
  }

  const signedPull = precisionMid - equalMid;
  const pull = Math.abs(signedPull);
  const pullStd = equalWidth === 0 ? 0 : pull / equalWidth;
  let pullDirection: 'up' | 'down' | 'neutral';
  if (signedPull > 0) pullDirection = 'up';
  else if (signedPull < 0) pullDirection = 'down';
  else pullDirection = 'neutral';

  const weightGini = giniOfWeights(weightShares);

  // Dominant lens = largest weight share (canonical-order tie-break).
  let dominantIdx = 0;
  let dominantWeightShare = weightShares[0]!;
  for (let i = 1; i < N_LENSES; i++) {
    if (weightShares[i]! > dominantWeightShare) {
      dominantWeightShare = weightShares[i]!;
      dominantIdx = i;
    }
  }
  const dominantLens = SLOPE_PRECISION_PULL_LENS_NAMES[dominantIdx]!;

  // mostPrecisionPullingLens: among lenses with weightShare > 1/N (above
  // average precision), the one whose midpoint is furthest from equalMid.
  // Canonical-order tie-break. If no lens is above average, default to
  // dominantLens.
  let mostPullIdx = -1;
  let mostPullDist = -1;
  const avgShare = 1 / N_LENSES;
  for (let i = 0; i < N_LENSES; i++) {
    if (weightShares[i]! > avgShare) {
      const d = Math.abs(mids[i]! - equalMid);
      if (d > mostPullDist) {
        mostPullDist = d;
        mostPullIdx = i;
      }
    }
  }
  const mostPrecisionPullingLens =
    mostPullIdx >= 0
      ? SLOPE_PRECISION_PULL_LENS_NAMES[mostPullIdx]!
      : dominantLens;

  const precisionAlignmentScore = 1 / (1 + pullStd);

  return {
    equalMid,
    equalWidth,
    precisionMid,
    signedPull,
    pull,
    pullStd,
    pullDirection,
    weightShares,
    weightGini,
    dominantLens,
    dominantWeightShare,
    mostPrecisionPullingLens,
    precisionAlignmentScore,
  };
}

export function buildSourceRowTokenSlopeCiPrecisionPull(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiPrecisionPullOptions = {},
): SourceRowTokenSlopeCiPrecisionPullReport {
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
  const alertMisaligned = opts.alertMisaligned ?? null;
  if (alertMisaligned !== null) {
    if (
      !Number.isFinite(alertMisaligned) ||
      alertMisaligned <= 0 ||
      alertMisaligned > 1
    ) {
      throw new Error(
        `alertMisaligned must be a finite number in (0, 1] (got ${opts.alertMisaligned})`,
      );
    }
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'alignment-desc';
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
  const lensReports: Record<SlopePrecisionPullLensName, Map<string, PerLensRaw>> =
    {
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
  for (const lens of SLOPE_PRECISION_PULL_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_PRECISION_PULL_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiPrecisionPullRow[] = [];
  for (const s of sharedSources) {
    const mids: number[] = [];
    const widths: number[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_PRECISION_PULL_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      mids.push((lo + hi) / 2);
      widths.push(hi - lo);
    }
    const computed = precisionPull(mids, widths);
    rows.push({
      source: s,
      rowsKept,
      ...computed,
    });
  }

  const alignments = rows.map((r) => r.precisionAlignmentScore);
  const meanPrecisionAlignment =
    alignments.length > 0
      ? alignments.reduce((a, b) => a + b, 0) / alignments.length
      : 0;
  const medianPrecisionAlignment = median(alignments);
  const meanWeightGini =
    rows.length > 0
      ? rows.reduce((a, b) => a + b.weightGini, 0) / rows.length
      : 0;

  let globalDominantLens: SlopePrecisionPullLensName | null = null;
  let globalPullDirection: 'up' | 'down' | 'neutral' | null = null;
  if (rows.length > 0) {
    const dominantCounts = new Map<SlopePrecisionPullLensName, number>();
    for (const lens of SLOPE_PRECISION_PULL_LENS_NAMES) {
      dominantCounts.set(lens, 0);
    }
    const dirCounts: Record<'up' | 'down' | 'neutral', number> = {
      up: 0,
      down: 0,
      neutral: 0,
    };
    for (const r of rows) {
      dominantCounts.set(
        r.dominantLens,
        dominantCounts.get(r.dominantLens)! + 1,
      );
      dirCounts[r.pullDirection] += 1;
    }
    let maxC = -1;
    for (const lens of SLOPE_PRECISION_PULL_LENS_NAMES) {
      const c = dominantCounts.get(lens)!;
      if (c > maxC) {
        maxC = c;
        globalDominantLens = lens;
      }
    }
    // Tie-break: up > down > neutral
    const dirOrder: Array<'up' | 'down' | 'neutral'> = ['up', 'down', 'neutral'];
    let maxD = -1;
    for (const d of dirOrder) {
      if (dirCounts[d] > maxD) {
        maxD = dirCounts[d];
        globalPullDirection = d;
      }
    }
  }

  let droppedAboveAlert = 0;
  let filtered = rows;
  if (alertMisaligned !== null) {
    const before = filtered.length;
    filtered = filtered.filter(
      (r) => r.precisionAlignmentScore < alertMisaligned,
    );
    droppedAboveAlert = before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiPrecisionPullRow,
      b: SourceRowTokenSlopeCiPrecisionPullRow,
    ) => number
  > = {
    'alignment-desc': (a, b) =>
      b.precisionAlignmentScore - a.precisionAlignmentScore,
    'alignment-asc': (a, b) =>
      a.precisionAlignmentScore - b.precisionAlignmentScore,
    'pull-std-desc': (a, b) => b.pullStd - a.pullStd,
    'pull-std-asc': (a, b) => a.pullStd - b.pullStd,
    'weight-gini-desc': (a, b) => b.weightGini - a.weightGini,
    'weight-gini-asc': (a, b) => a.weightGini - b.weightGini,
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
    alertMisaligned,
    top,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    droppedAboveAlert,
    meanPrecisionAlignment,
    medianPrecisionAlignment,
    meanWeightGini,
    globalDominantLens,
    globalPullDirection,
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
 * When `showWeights` is true, a per-source 6-row sub-table is
 * appended showing weightShare for each lens (canonical order),
 * useful for full attribution of the precision pool.
 *
 * When `showPullSummary` is true, a compact one-line directional
 * summary is appended after each source row naming the
 * `dominantLens`, the `pullDirection` (`up`/`down`/`neutral`),
 * the raw `signedPull` value, and the `dominantWeightShare`.
 * Lighter-weight alternative to `--show-weights` that surfaces
 * just the headline of who is pulling consensus and which way.
 */
export function renderSourceRowTokenSlopeCiPrecisionPull(
  r: SourceRowTokenSlopeCiPrecisionPullReport,
  opts: { showWeights?: boolean; showPullSummary?: boolean } = {},
): string {
  const showWeights = opts.showWeights ?? false;
  const showPullSummary = opts.showPullSummary ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-precision-pull');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-misaligned: ${r.alertMisaligned ?? '-'}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedAboveAlert} above-alert-threshold; meanPrecisionAlignment: ${fmtNum(r.meanPrecisionAlignment)}; medianPrecisionAlignment: ${fmtNum(r.medianPrecisionAlignment)}; meanWeightGini: ${fmtNum(r.meanWeightGini)}; globalDominantLens: ${r.globalDominantLens ?? '-'}; globalPullDirection: ${r.globalPullDirection ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  equalMid    precisionMid  signedPull  pullStd   dir   gini      align     dominantLens       domShare  mostPullingLens',
  );
  lines.push(
    '---------------  ----  ----------  ------------  ----------  --------  ----  --------  --------  -----------------  --------  -----------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        fmtNum(row.equalMid).padStart(10),
        fmtNum(row.precisionMid).padStart(12),
        fmtNum(row.signedPull).padStart(10),
        fmtNum(row.pullStd).padStart(8),
        row.pullDirection.padEnd(4),
        fmtNum(row.weightGini).padStart(8),
        fmtNum(row.precisionAlignmentScore).padStart(8),
        row.dominantLens.padEnd(17),
        fmtNum(row.dominantWeightShare).padStart(8),
        row.mostPrecisionPullingLens.padEnd(17),
      ].join('  '),
    );
    if (showPullSummary) {
      const arrow =
        row.pullDirection === 'up'
          ? '^'
          : row.pullDirection === 'down'
            ? 'v'
            : '=';
      lines.push(
        `    summary: dominant ${row.dominantLens} (share=${fmtNum(row.dominantWeightShare)}) pulls consensus ${row.pullDirection} ${arrow} (signedPull=${fmtNum(row.signedPull)})`,
      );
    }
    if (showWeights) {
      lines.push(
        '    lens               weightShare',
      );
      for (let i = 0; i < SLOPE_PRECISION_PULL_LENS_NAMES.length; i++) {
        lines.push(
          [
            '   ',
            SLOPE_PRECISION_PULL_LENS_NAMES[i]!.padEnd(17),
            fmtNum(row.weightShares[i]!).padStart(11),
          ].join('  '),
        );
      }
    }
  }
  return lines.join('\n');
}
