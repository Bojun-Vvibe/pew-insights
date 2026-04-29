/**
 * source-row-token-slope-ci-cross-lens-agreement
 *
 * Cross-lens agreement diagnostic for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the per-source CIs
 * produced by the six independent lenses shipped between v0.6.220
 * and v0.6.225:
 *
 *   1. percentile bootstrap     (v0.6.220)
 *   2. jackknife normal         (v0.6.221)
 *   3. BCa bootstrap            (v0.6.222)
 *   4. studentized-t bootstrap  (v0.6.223)
 *   5. ABC bootstrap            (v0.6.224)
 *   6. profile-likelihood       (v0.6.225)
 *
 * For each source that survives the floor in all six lenses, this
 * module assembles the six `[ciLower, ciUpper]` intervals and
 * reports:
 *
 *   - the 15 pairwise lens-vs-lens interval overlap fractions
 *     (overlap length / shorter-interval length),
 *   - the mean Jaccard index across those 15 pairs (the
 *     "cross-lens agreement index" in [0, 1]),
 *   - the strict consensus interval = intersection of all six,
 *   - the loose union interval = union envelope of all six,
 *   - a `lensesAgree` flag = true iff the consensus interval is
 *     non-empty (every pair overlaps),
 *   - a `consensusIntervalIsEmpty` boolean for direct filtering,
 *   - the slope-point dispersion across lenses (max-min and std).
 *
 * Mechanically distinct from every prior lens: this is NOT a new
 * CI estimator. It is a diagnostic that consumes the existing six
 * and surfaces *disagreement* between them. A source where all six
 * lenses overlap heavily (agreement index near 1) is one where the
 * choice of CI method does not matter; a source where the six
 * lenses produce nearly-disjoint intervals (agreement index near
 * 0) is one where downstream conclusions depend critically on
 * which lens was chosen, and the analyst must look harder.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type LensName = (typeof LENS_NAMES)[number];

export interface SourceRowTokenSlopeCiCrossLensAgreementOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Drop sources with fewer than this many kept rows. Integer >= 4. */
  minRows?: number;
  /** Confidence level in (0, 1). Default 0.95. */
  confidence?: number;
  /** Variance ratio for the underlying Deming fit. Finite > 0. Default 1. */
  lambda?: number;
  /** Bootstrap replicate count for the four resample-based lenses. Default 1000. */
  bootstraps?: number;
  /** LCG seed shared across the four resample-based lenses. Default 42. */
  seed?: number;
  /**
   * If true, only emit sources where the six lenses fail to agree
   * (consensus interval is empty). Default false.
   */
  alertDisagree?: boolean;
  /** If true, only emit sources whose union envelope contains zero. Default false. */
  alertZeroInUnion?: boolean;
  top?: number | null;
  sort?:
    | 'agreement-asc'
    | 'agreement-desc'
    | 'consensus-width-desc'
    | 'consensus-width-asc'
    | 'union-width-desc'
    | 'union-width-asc'
    | 'slope-spread-desc'
    | 'loosest-pair-jaccard-asc'
    | 'tightest-pair-jaccard-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiCrossLensAgreementPair {
  /** Lens A name. */
  a: LensName;
  /** Lens B name (lexically after A in `LENS_NAMES` order). */
  b: LensName;
  /** Length of the intersection of the two intervals (0 if disjoint). */
  overlap: number;
  /** Jaccard similarity = overlap / union length, in [0, 1]. */
  jaccard: number;
  /** True iff the two intervals do not overlap at all. */
  disjoint: boolean;
}

export interface SourceRowTokenSlopeCiCrossLensAgreementRow {
  source: string;
  rowsKept: number;
  /** Per-lens point slope (tokens/row). */
  slopes: Record<LensName, number>;
  /** Per-lens [ciLower, ciUpper]. */
  cis: Record<LensName, { ciLower: number; ciUpper: number; ciWidth: number }>;
  /** All 15 pairwise overlap entries, in `LENS_NAMES` lexicographic order. */
  pairs: SourceRowTokenSlopeCiCrossLensAgreementPair[];
  /** Mean Jaccard across the 15 pairs, in [0, 1]. */
  agreementIndex: number;
  /** Strict consensus = intersection of all six intervals (NaN endpoints if empty). */
  consensusLower: number;
  consensusUpper: number;
  consensusWidth: number;
  consensusIntervalIsEmpty: boolean;
  /** Loose envelope = union over all six intervals. */
  unionLower: number;
  unionUpper: number;
  unionWidth: number;
  /** True iff `consensusLower <= 0 <= consensusUpper` (strict consensus straddles zero). */
  consensusContainsZero: boolean;
  /** True iff `unionLower <= 0 <= unionUpper` (loose envelope straddles zero). */
  unionContainsZero: boolean;
  /** True iff every pair overlaps (= !consensusIntervalIsEmpty). */
  lensesAgree: boolean;
  /** Number of disjoint pairs out of 15. */
  disjointPairCount: number;
  /** Max - min of the six point slopes. */
  slopeSpread: number;
  /** Sample std (n-1) of the six point slopes. */
  slopeStd: number;
  /**
   * The pair of lenses with the **highest** Jaccard similarity for
   * this source. When `lensesAgree = true`, this is the pair that
   * is *most* in agreement; useful for triaging which two lenses
   * one could quote interchangeably without conclusion change.
   * `null` only in degenerate (no-pairs) configurations.
   * (Refinement field, v0.6.227 follow-up.)
   */
  tightestPair: { a: LensName; b: LensName; jaccard: number } | null;
  /**
   * The pair of lenses with the **lowest** Jaccard similarity for
   * this source. The pair that drives the disagreement signal —
   * if you flip from `a` to `b` your CI will look most different.
   * (Refinement field, v0.6.227 follow-up.)
   */
  loosestPair: { a: LensName; b: LensName; jaccard: number } | null;
}

export interface SourceRowTokenSlopeCiCrossLensAgreementReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertDisagree: boolean;
  alertZeroInUnion: boolean;
  top: number | null;
  sort:
    | 'agreement-asc'
    | 'agreement-desc'
    | 'consensus-width-desc'
    | 'consensus-width-asc'
    | 'union-width-desc'
    | 'union-width-asc'
    | 'slope-spread-desc'
    | 'loosest-pair-jaccard-asc'
    | 'tightest-pair-jaccard-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  /** Sources surviving every lens (intersection of the six lens populations). */
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedNotDisagree: number;
  droppedNotZeroInUnion: number;
  droppedBelowTopCap: number;
  /** Count of sources whose six lenses fail to all-overlap. */
  disagreeCount: number;
  sources: SourceRowTokenSlopeCiCrossLensAgreementRow[];
}

const ABSOLUTE_MIN_ROWS = 4;

const VALID_SORTS = [
  'agreement-asc',
  'agreement-desc',
  'consensus-width-desc',
  'consensus-width-asc',
  'union-width-desc',
  'union-width-asc',
  'slope-spread-desc',
  'loosest-pair-jaccard-asc',
  'tightest-pair-jaccard-desc',
  'rows',
  'source',
] as const;

/**
 * Pairwise overlap of two closed intervals `[aLo, aHi]` and `[bLo, bHi]`.
 * Returns 0 if disjoint. Both intervals are assumed to satisfy lo <= hi
 * (callers ensure this; a lens with ciLower > ciUpper would be a bug
 * upstream).
 */
export function intervalOverlap(
  aLo: number,
  aHi: number,
  bLo: number,
  bHi: number,
): number {
  const lo = Math.max(aLo, bLo);
  const hi = Math.min(aHi, bHi);
  if (hi <= lo) return 0;
  return hi - lo;
}

/**
 * Jaccard similarity of two closed intervals. Defined as
 * `|A ∩ B| / |A ∪ B|`. Returns 0 if both intervals are points
 * AND they coincide (degenerate union length 0); returns 1 if both
 * are the same point. Returns 0 if disjoint and at least one has
 * positive length. The implementation:
 *
 *   - If union length > 0:  jaccard = overlap / unionLength.
 *   - If union length == 0 (both are the same single point):
 *       jaccard = 1.
 */
export function intervalJaccard(
  aLo: number,
  aHi: number,
  bLo: number,
  bHi: number,
): number {
  const overlap = intervalOverlap(aLo, aHi, bLo, bHi);
  const unionLo = Math.min(aLo, bLo);
  const unionHi = Math.max(aHi, bHi);
  const unionLength = unionHi - unionLo;
  if (unionLength === 0) {
    // Both are the same single point (otherwise unionLength > 0).
    return aLo === bLo ? 1 : 0;
  }
  return overlap / unionLength;
}

/**
 * Strict consensus interval = intersection of all the supplied
 * `[lo, hi]` intervals. Returns `{ lo: NaN, hi: NaN, isEmpty: true }`
 * if the intersection is empty (i.e. some pair is disjoint).
 */
export function consensusInterval(
  intervals: ReadonlyArray<{ lo: number; hi: number }>,
): { lo: number; hi: number; isEmpty: boolean } {
  if (intervals.length === 0) return { lo: NaN, hi: NaN, isEmpty: true };
  let lo = -Infinity;
  let hi = Infinity;
  for (const iv of intervals) {
    if (iv.lo > lo) lo = iv.lo;
    if (iv.hi < hi) hi = iv.hi;
  }
  if (hi < lo) return { lo: NaN, hi: NaN, isEmpty: true };
  return { lo, hi, isEmpty: false };
}

/** Loose envelope = [min lower, max upper] across all supplied intervals. */
export function unionEnvelope(
  intervals: ReadonlyArray<{ lo: number; hi: number }>,
): { lo: number; hi: number } {
  if (intervals.length === 0) return { lo: NaN, hi: NaN };
  let lo = Infinity;
  let hi = -Infinity;
  for (const iv of intervals) {
    if (iv.lo < lo) lo = iv.lo;
    if (iv.hi > hi) hi = iv.hi;
  }
  return { lo, hi };
}

/**
 * Mean Jaccard across all unordered pairs of the supplied intervals.
 * For 6 lenses there are C(6, 2) = 15 pairs.
 */
export function meanPairwiseJaccard(
  intervals: ReadonlyArray<{ lo: number; hi: number }>,
): number {
  const n = intervals.length;
  if (n < 2) return 1;
  let total = 0;
  let count = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = intervals[i]!;
      const b = intervals[j]!;
      total += intervalJaccard(a.lo, a.hi, b.lo, b.hi);
      count += 1;
    }
  }
  return total / count;
}

function sampleStd(xs: readonly number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  let mean = 0;
  for (const x of xs) mean += x;
  mean /= n;
  let ss = 0;
  for (const x of xs) {
    const d = x - mean;
    ss += d * d;
  }
  return Math.sqrt(ss / (n - 1));
}

export function buildSourceRowTokenSlopeCiCrossLensAgreement(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiCrossLensAgreementOptions = {},
): SourceRowTokenSlopeCiCrossLensAgreementReport {
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
  const alertDisagree = opts.alertDisagree ?? false;
  const alertZeroInUnion = opts.alertZeroInUnion ?? false;
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'agreement-asc';
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
  const jackknifeReport = buildSourceRowTokenJackknifeSlopeCi(
    queue,
    sharedOpts,
  );
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

  // Build per-lens lookup maps keyed by source.
  const lensReports: Record<
    LensName,
    Map<
      string,
      { source: string; rowsKept: number; slope: number; ciLower: number; ciUpper: number }
    >
  > = {
    bootstrap: new Map(bootstrapReport.sources.map((r) => [r.source, r])),
    jackknife: new Map(jackknifeReport.sources.map((r) => [r.source, r])),
    bca: new Map(bcaReport.sources.map((r) => [r.source, r])),
    studentizedT: new Map(studReport.sources.map((r) => [r.source, r])),
    abc: new Map(abcReport.sources.map((r) => [r.source, r])),
    profileLikelihood: new Map(profileReport.sources.map((r) => [r.source, r])),
  };

  // Authoritative source list = sources present in *every* lens.
  // The four bootstrap-family lenses + jackknife + ABC + profile each
  // apply the same minRows floor to the same row population, so the
  // intersection should equal the bootstrap source list under normal
  // operation; we still compute it explicitly to defend against any
  // lens-specific dropping that might be introduced later.
  const allSources = new Set<string>(bootstrapReport.sources.map((r) => r.source));
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  // Also count any source the other lenses uniquely surfaced (defensive).
  for (const lens of LENS_NAMES) {
    for (const s of lensReports[lens].keys()) {
      if (!allSources.has(s)) {
        droppedMissingLens += 1;
        allSources.add(s); // dedupe accounting only
      }
    }
  }

  const rows: SourceRowTokenSlopeCiCrossLensAgreementRow[] = [];

  for (const s of sharedSources) {
    const slopes: Record<LensName, number> = {} as Record<LensName, number>;
    const cis: Record<
      LensName,
      { ciLower: number; ciUpper: number; ciWidth: number }
    > = {} as Record<LensName, { ciLower: number; ciUpper: number; ciWidth: number }>;
    let rowsKept = 0;
    const intervals: { lo: number; hi: number }[] = [];

    for (const lens of LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      slopes[lens] = r.slope;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      cis[lens] = { ciLower: r.ciLower, ciUpper: r.ciUpper, ciWidth: hi - lo };
      intervals.push({ lo, hi });
      rowsKept = r.rowsKept; // identical across lenses
    }

    // Pairwise table (15 unordered pairs).
    const pairs: SourceRowTokenSlopeCiCrossLensAgreementPair[] = [];
    let disjointPairCount = 0;
    for (let i = 0; i < LENS_NAMES.length; i += 1) {
      for (let j = i + 1; j < LENS_NAMES.length; j += 1) {
        const a = intervals[i]!;
        const b = intervals[j]!;
        const overlap = intervalOverlap(a.lo, a.hi, b.lo, b.hi);
        const jaccard = intervalJaccard(a.lo, a.hi, b.lo, b.hi);
        const disjoint = overlap === 0 && !(a.lo === b.lo && a.hi === b.hi);
        if (disjoint) disjointPairCount += 1;
        pairs.push({
          a: LENS_NAMES[i]!,
          b: LENS_NAMES[j]!,
          overlap,
          jaccard,
          disjoint,
        });
      }
    }

    const agreementIndex = meanPairwiseJaccard(intervals);
    const consensus = consensusInterval(intervals);
    const union = unionEnvelope(intervals);

    const slopeArr = LENS_NAMES.map((l) => slopes[l]);
    const slopeMin = Math.min(...slopeArr);
    const slopeMax = Math.max(...slopeArr);

    let tightestPair: { a: LensName; b: LensName; jaccard: number } | null = null;
    let loosestPair: { a: LensName; b: LensName; jaccard: number } | null = null;
    for (const p of pairs) {
      if (tightestPair === null || p.jaccard > tightestPair.jaccard) {
        tightestPair = { a: p.a, b: p.b, jaccard: p.jaccard };
      }
      if (loosestPair === null || p.jaccard < loosestPair.jaccard) {
        loosestPair = { a: p.a, b: p.b, jaccard: p.jaccard };
      }
    }

    rows.push({
      source: s,
      rowsKept,
      slopes,
      cis,
      pairs,
      agreementIndex,
      consensusLower: consensus.lo,
      consensusUpper: consensus.hi,
      consensusWidth: consensus.isEmpty ? 0 : consensus.hi - consensus.lo,
      consensusIntervalIsEmpty: consensus.isEmpty,
      unionLower: union.lo,
      unionUpper: union.hi,
      unionWidth: union.hi - union.lo,
      consensusContainsZero:
        !consensus.isEmpty && consensus.lo <= 0 && consensus.hi >= 0,
      unionContainsZero: union.lo <= 0 && union.hi >= 0,
      lensesAgree: !consensus.isEmpty,
      disjointPairCount,
      slopeSpread: slopeMax - slopeMin,
      slopeStd: sampleStd(slopeArr),
      tightestPair,
      loosestPair,
    });
  }

  // Filters.
  let filtered = rows;
  let droppedNotDisagree = 0;
  if (alertDisagree) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.consensusIntervalIsEmpty);
    droppedNotDisagree = before - filtered.length;
  }
  let droppedNotZeroInUnion = 0;
  if (alertZeroInUnion) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.unionContainsZero);
    droppedNotZeroInUnion = before - filtered.length;
  }

  // Sort.
  const sortFns: Record<
    typeof VALID_SORTS[number],
    (a: SourceRowTokenSlopeCiCrossLensAgreementRow, b: SourceRowTokenSlopeCiCrossLensAgreementRow) => number
  > = {
    'agreement-asc': (a, b) => a.agreementIndex - b.agreementIndex,
    'agreement-desc': (a, b) => b.agreementIndex - a.agreementIndex,
    'consensus-width-desc': (a, b) => b.consensusWidth - a.consensusWidth,
    'consensus-width-asc': (a, b) => a.consensusWidth - b.consensusWidth,
    'union-width-desc': (a, b) => b.unionWidth - a.unionWidth,
    'union-width-asc': (a, b) => a.unionWidth - b.unionWidth,
    'slope-spread-desc': (a, b) => b.slopeSpread - a.slopeSpread,
    'loosest-pair-jaccard-asc': (a, b) =>
      (a.loosestPair?.jaccard ?? -Infinity) -
      (b.loosestPair?.jaccard ?? -Infinity),
    'tightest-pair-jaccard-desc': (a, b) =>
      (b.tightestPair?.jaccard ?? -Infinity) -
      (a.tightestPair?.jaccard ?? -Infinity),
    rows: (a, b) => b.rowsKept - a.rowsKept,
    source: (a, b) => a.source.localeCompare(b.source),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return a.source.localeCompare(b.source);
  });

  // Top cap.
  let droppedBelowTopCap = 0;
  if (top !== null && filtered.length > top) {
    droppedBelowTopCap = filtered.length - top;
    filtered = filtered.slice(0, top);
  }

  const disagreeCount = rows.filter((r) => r.consensusIntervalIsEmpty).length;
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
    alertDisagree,
    alertZeroInUnion,
    top,
    sort,
    totalSources: rows.length + droppedMissingLens,
    totalRowsKept,
    sourcesWithAllLenses: rows.length,
    droppedMissingLens,
    droppedNotDisagree,
    droppedNotZeroInUnion,
    droppedBelowTopCap,
    disagreeCount,
    sources: filtered,
  };
}

/**
 * Plain-text renderer. Does not depend on the format.ts chalk
 * helpers (kept self-contained so the module is testable in
 * isolation and renders cleanly when piped through `less` or `cat`).
 */
export function renderSourceRowTokenSlopeCiCrossLensAgreement(
  r: SourceRowTokenSlopeCiCrossLensAgreementReport,
): string {
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-cross-lens-agreement');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses}, shown ${r.sources.length})    rows: ${r.totalRowsKept}    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-disagree: ${r.alertDisagree ? 'yes' : 'no'}    alert-zero-in-union: ${r.alertZeroInUnion ? 'yes' : 'no'}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedNotDisagree} all-lenses-agree (alert), ${r.droppedNotZeroInUnion} union excludes zero (alert), ${r.droppedBelowTopCap} below top cap; lens-disagree count (consensus empty): ${r.disagreeCount}`,
  );
  lines.push('');
  if (r.sources.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  agreeIdx  djPairs  consensusW    unionW        slopeSpread   agree?  loosestPair (jaccard)',
  );
  lines.push(
    '---------------  ----  --------  -------  ------------  ------------  ------------  ------  ---------------------',
  );
  for (const row of r.sources) {
    const lp = row.loosestPair
      ? `${row.loosestPair.a}↔${row.loosestPair.b} (${row.loosestPair.jaccard.toFixed(4)})`
      : '-';
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        row.agreementIndex.toFixed(6).padStart(8),
        String(row.disjointPairCount).padStart(7),
        (row.consensusIntervalIsEmpty ? 'EMPTY' : row.consensusWidth.toFixed(4)).padStart(12),
        row.unionWidth.toFixed(4).padStart(12),
        row.slopeSpread.toFixed(4).padStart(12),
        (row.lensesAgree ? 'yes' : 'NO').padStart(6),
        lp,
      ].join('  '),
    );
  }
  return lines.join('\n');
}
