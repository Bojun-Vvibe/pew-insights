/**
 * source-row-token-slope-ci-containment-nestedness
 *
 * Per-source CI-CONTAINMENT diagnostic for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six per-source
 * slope CIs that the rest of the cross-lens family consumes:
 *
 *   1. percentile bootstrap     (v0.6.220)
 *   2. jackknife normal         (v0.6.221)
 *   3. BCa bootstrap            (v0.6.222)
 *   4. studentized-t bootstrap  (v0.6.223)
 *   5. ABC bootstrap            (v0.6.224)
 *   6. profile-likelihood       (v0.6.225)
 *
 * Mechanically distinct from ALL SIX prior cross-lens diagnostics
 * (v0.6.227 jaccard, v0.6.228 sign, v0.6.229 width, v0.6.230
 * overlap-graph topology, v0.6.231 midpoint-dispersion location,
 * v0.6.232 asymmetry-shape) because it is the only one that
 * classifies the JOINT (location + width) inclusion structure of
 * each pair of CIs.
 *
 *   - Jaccard collapses each pair to a single overlap fraction in
 *     [0, 1] and loses inclusion direction.
 *   - Overlap-graph reduces each pair to a single bit (overlap or
 *     disjoint) and loses width altogether.
 *   - Width-concordance compares CI widths in isolation; two CIs of
 *     identical width never nest, so width-concordance can be
 *     maximally agreeing while no nesting exists at all.
 *   - Midpoint-dispersion measures center spread; two CIs centered
 *     identically can nest perfectly OR be identical OR sit
 *     side-by-side -- centers alone don't say.
 *   - Asymmetry measures shape AROUND the point estimate inside a
 *     single CI; says nothing pairwise.
 *
 *   This module classifies each of the C(6,2) = 15 pairs of CIs as
 *   one of five mutually exclusive types:
 *
 *     EQ     -- the two CIs have IDENTICAL endpoints (lo_a == lo_b
 *               AND hi_a == hi_b);
 *     A_IN_B -- A is STRICTLY nested inside B (lo_b < lo_a AND
 *               hi_a < hi_b -- B both starts earlier and ends later
 *               than A, with strict inequalities on both sides);
 *     B_IN_A -- mirror of A_IN_B;
 *     PARTIAL -- the CIs intersect but neither strictly contains
 *               the other AND they're not equal (one endpoint pair
 *               crosses);
 *     DISJOINT -- the CIs do not intersect at all (hi_a < lo_b OR
 *               hi_b < lo_a, strict).
 *
 *   The five buckets are MECE, exhaust the 15 pairs, and depend on
 *   the JOINT relation of (lo, hi) -- exactly the information no
 *   prior diagnostic in the family has surfaced.
 *
 *   From the pair classification we derive a per-lens CONTAINMENT
 *   PROFILE (`contains[i]` = how many other lenses lens i strictly
 *   contains; `containedBy[i]` = how many strictly contain lens i;
 *   `equalTo[i]` = how many lens i is exactly equal to). The lens
 *   with `contains[i] == 5` is the WIDEST and most-conservative;
 *   the one with `containedBy[i] == 5` is the TIGHTEST and most-
 *   confident. A clean nesting CHAIN (every pair is EQ or strict
 *   nest, no PARTIAL or DISJOINT) means the six CIs form a total
 *   order under inclusion -- `nestingChainDepth` reaches its
 *   maximum 6 in that case.
 *
 * Per source we report:
 *
 *   - `pairs` -- 15-vector of pair classifications in canonical
 *     pair order (i < j over canonical lens order);
 *   - `eqPairs`, `nestedPairs`, `partialPairs`, `disjointPairs` --
 *     bucket counts (sum to 15);
 *   - `nestingChainDepth` -- length of the longest chain of CIs
 *     under STRICT inclusion (or equality). 6 means total order.
 *     1 means no two CIs nest;
 *   - `cleanChain` -- boolean: every pair is EQ or strict nest
 *     (no PARTIAL, no DISJOINT);
 *   - `widestLens`, `tightestLens` -- lens with the most strict
 *     containments / strict containedBys. Ties broken by canonical
 *     lens order;
 *   - `widestContains`, `tightestContainedBy` -- the corresponding
 *     counts in [0, 5];
 *   - `contains`, `containedBy`, `equalTo` -- 6-vectors of per-lens
 *     containment profile in canonical lens order;
 *   - `meanWidth`, `widthSpread` -- mean and (max-min) of the six
 *     CI widths;
 *   - `nestingFraction` -- (eqPairs + nestedPairs) / 15 in [0, 1].
 *     Headline metric: 1 means perfect total-order inclusion;
 *     0 means no pair nests;
 *   - `disjointFraction` -- disjointPairs / 15 in [0, 1]. The
 *     red-flag complement: 0 means every pair at least overlaps;
 *     positive means the lenses materially disagree on the slope's
 *     range;
 *   - `anyDisjoint` -- boolean: at least one pair is DISJOINT
 *     (lenses produce non-overlapping confidence ranges -- a
 *     red flag the other six diagnostics cannot raise pairwise).
 *
 * Containment uses STRICT inequalities: the boundary case lo_a ==
 * lo_b with hi_a < hi_b is classified as PARTIAL, not A_IN_B.
 * Equality requires BOTH endpoints to match exactly. This matches
 * the floating-point regime of the lens kernels: deliberately-
 * symmetric constructions return identical endpoints exactly,
 * while floating noise around shared midpoints surfaces as PARTIAL
 * rather than spurious nesting.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_CONTAINMENT_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeContainmentLensName =
  (typeof SLOPE_CONTAINMENT_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_CONTAINMENT_LENS_NAMES.length;
const N_PAIRS = (N_LENSES * (N_LENSES - 1)) / 2; // 15

export type CiPairRelation =
  | 'EQ'
  | 'A_IN_B'
  | 'B_IN_A'
  | 'PARTIAL'
  | 'DISJOINT';

/**
 * Classify the relation of CI A = [aLo, aHi] vs CI B = [bLo, bHi]
 * under STRICT inclusion. Returns one of five MECE buckets.
 *
 * Throws on non-finite inputs or ill-formed (lo > hi) intervals.
 */
export function classifyPair(
  aLo: number,
  aHi: number,
  bLo: number,
  bHi: number,
): CiPairRelation {
  for (const v of [aLo, aHi, bLo, bHi]) {
    if (!Number.isFinite(v)) {
      throw new Error(`classifyPair: non-finite endpoint (${v})`);
    }
  }
  if (aLo > aHi) {
    throw new Error(`classifyPair: A is ill-formed (aLo=${aLo} > aHi=${aHi})`);
  }
  if (bLo > bHi) {
    throw new Error(`classifyPair: B is ill-formed (bLo=${bLo} > bHi=${bHi})`);
  }
  if (aLo === bLo && aHi === bHi) return 'EQ';
  if (bLo < aLo && aHi < bHi) return 'A_IN_B';
  if (aLo < bLo && bHi < aHi) return 'B_IN_A';
  if (aHi < bLo || bHi < aLo) return 'DISJOINT';
  return 'PARTIAL';
}

/**
 * Compute the longest chain of intervals under inclusion (with
 * equality permitted). Inputs are 6 (lo, hi) pairs in canonical
 * lens order. Returns an integer in [1, 6]. The DAG edge is
 * `i -> j` iff interval i is contained in interval j (strictly OR
 * equally), meaning `lo_j <= lo_i && hi_i <= hi_j`. Longest path
 * is computed by sorting intervals by width ascending and running
 * the standard topological DP.
 */
export function nestingChainDepthOf(
  intervals: { lo: number; hi: number }[],
): number {
  const n = intervals.length;
  if (n === 0) return 0;
  const dp = new Array<number>(n).fill(1);
  const order = [...Array(n).keys()].sort((a, b) => {
    const wa = intervals[a]!.hi - intervals[a]!.lo;
    const wb = intervals[b]!.hi - intervals[b]!.lo;
    if (wa !== wb) return wa - wb;
    if (intervals[a]!.lo !== intervals[b]!.lo)
      return intervals[a]!.lo - intervals[b]!.lo;
    return intervals[b]!.hi - intervals[a]!.hi;
  });
  for (let oj = 0; oj < n; oj++) {
    const j = order[oj]!;
    for (let oi = 0; oi < oj; oi++) {
      const i = order[oi]!;
      if (
        intervals[j]!.lo <= intervals[i]!.lo &&
        intervals[i]!.hi <= intervals[j]!.hi
      ) {
        if (dp[i]! + 1 > dp[j]!) dp[j] = dp[i]! + 1;
      }
    }
  }
  let best = 1;
  for (const v of dp) if (v > best) best = v;
  return best;
}

export interface SourceRowTokenSlopeCiContainmentNestednessOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertDisjoint?: boolean;
  alertCleanChain?: boolean;
  top?: number | null;
  sort?:
    | 'nesting-fraction-desc'
    | 'nesting-fraction-asc'
    | 'disjoint-fraction-desc'
    | 'disjoint-fraction-asc'
    | 'chain-depth-desc'
    | 'chain-depth-asc'
    | 'nested-pairs-desc'
    | 'partial-pairs-desc'
    | 'disjoint-pairs-desc'
    | 'eq-pairs-desc'
    | 'widest-contains-desc'
    | 'tightest-contained-by-desc'
    | 'mean-width-desc'
    | 'width-spread-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiContainmentNestednessRow {
  source: string;
  rowsKept: number;
  pairs: CiPairRelation[];
  eqPairs: number;
  nestedPairs: number;
  partialPairs: number;
  disjointPairs: number;
  nestingChainDepth: number;
  cleanChain: boolean;
  widestLens: SlopeContainmentLensName;
  widestContains: number;
  tightestLens: SlopeContainmentLensName;
  tightestContainedBy: number;
  contains: number[];
  containedBy: number[];
  equalTo: number[];
  meanWidth: number;
  widthSpread: number;
  nestingFraction: number;
  disjointFraction: number;
  anyDisjoint: boolean;
}

export interface SourceRowTokenSlopeCiContainmentNestednessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertDisjoint: boolean;
  alertCleanChain: boolean;
  top: number | null;
  sort: NonNullable<
    SourceRowTokenSlopeCiContainmentNestednessOptions['sort']
  >;
  totalSources: number;
  totalRowsKept: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedNotDisjoint: number;
  droppedNotCleanChain: number;
  droppedBelowTopCap: number;
  anyDisjointCount: number;
  cleanChainCount: number;
  totalOrderCount: number;
  sources: SourceRowTokenSlopeCiContainmentNestednessRow[];
}

const VALID_SORTS = [
  'nesting-fraction-desc',
  'nesting-fraction-asc',
  'disjoint-fraction-desc',
  'disjoint-fraction-asc',
  'chain-depth-desc',
  'chain-depth-asc',
  'nested-pairs-desc',
  'partial-pairs-desc',
  'disjoint-pairs-desc',
  'eq-pairs-desc',
  'widest-contains-desc',
  'tightest-contained-by-desc',
  'mean-width-desc',
  'width-spread-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenSlopeCiContainmentNestedness(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiContainmentNestednessOptions = {},
): SourceRowTokenSlopeCiContainmentNestednessReport {
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
  const alertDisjoint = opts.alertDisjoint ?? false;
  const alertCleanChain = opts.alertCleanChain ?? false;
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'nesting-fraction-desc';
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

  type PerLensRaw = {
    source: string;
    rowsKept: number;
    slope: number;
    ciLower: number;
    ciUpper: number;
  };
  const lensReports: Record<SlopeContainmentLensName, Map<string, PerLensRaw>> =
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
  for (const lens of SLOPE_CONTAINMENT_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_CONTAINMENT_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }

  const rows: SourceRowTokenSlopeCiContainmentNestednessRow[] = [];

  for (const s of sharedSources) {
    const intervals: { lo: number; hi: number }[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_CONTAINMENT_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      intervals.push({ lo, hi });
    }

    const pairs: CiPairRelation[] = [];
    let eqPairs = 0;
    let nestedPairs = 0;
    let partialPairs = 0;
    let disjointPairs = 0;
    const contains = new Array<number>(N_LENSES).fill(0);
    const containedBy = new Array<number>(N_LENSES).fill(0);
    const equalTo = new Array<number>(N_LENSES).fill(0);
    for (let i = 0; i < N_LENSES; i++) {
      for (let j = i + 1; j < N_LENSES; j++) {
        const rel = classifyPair(
          intervals[i]!.lo,
          intervals[i]!.hi,
          intervals[j]!.lo,
          intervals[j]!.hi,
        );
        pairs.push(rel);
        if (rel === 'EQ') {
          eqPairs += 1;
          equalTo[i]! += 1;
          equalTo[j]! += 1;
        } else if (rel === 'A_IN_B') {
          nestedPairs += 1;
          contains[j]! += 1;
          containedBy[i]! += 1;
        } else if (rel === 'B_IN_A') {
          nestedPairs += 1;
          contains[i]! += 1;
          containedBy[j]! += 1;
        } else if (rel === 'PARTIAL') {
          partialPairs += 1;
        } else {
          disjointPairs += 1;
        }
      }
    }

    let widestIdx = 0;
    let widestVal = -1;
    for (let i = 0; i < N_LENSES; i++) {
      if (contains[i]! > widestVal) {
        widestVal = contains[i]!;
        widestIdx = i;
      }
    }
    let tightestIdx = 0;
    let tightestVal = -1;
    for (let i = 0; i < N_LENSES; i++) {
      if (containedBy[i]! > tightestVal) {
        tightestVal = containedBy[i]!;
        tightestIdx = i;
      }
    }

    let sumWidth = 0;
    let minWidth = Infinity;
    let maxWidth = -Infinity;
    for (const iv of intervals) {
      const w = iv.hi - iv.lo;
      sumWidth += w;
      if (w < minWidth) minWidth = w;
      if (w > maxWidth) maxWidth = w;
    }
    const meanWidth = sumWidth / N_LENSES;
    const widthSpread = maxWidth - minWidth;

    const nestingChainDepth = nestingChainDepthOf(intervals);
    const cleanChain = partialPairs === 0 && disjointPairs === 0;
    const nestingFraction = (eqPairs + nestedPairs) / N_PAIRS;
    const disjointFraction = disjointPairs / N_PAIRS;
    const anyDisjoint = disjointPairs > 0;

    rows.push({
      source: s,
      rowsKept,
      pairs,
      eqPairs,
      nestedPairs,
      partialPairs,
      disjointPairs,
      nestingChainDepth,
      cleanChain,
      widestLens: SLOPE_CONTAINMENT_LENS_NAMES[widestIdx]!,
      widestContains: widestVal,
      tightestLens: SLOPE_CONTAINMENT_LENS_NAMES[tightestIdx]!,
      tightestContainedBy: tightestVal,
      contains,
      containedBy,
      equalTo,
      meanWidth,
      widthSpread,
      nestingFraction,
      disjointFraction,
      anyDisjoint,
    });
  }

  const anyDisjointCount = rows.filter((r) => r.anyDisjoint).length;
  const cleanChainCount = rows.filter((r) => r.cleanChain).length;
  const totalOrderCount = rows.filter(
    (r) => r.cleanChain && r.nestingChainDepth === N_LENSES,
  ).length;

  let filtered = rows;
  let droppedNotDisjoint = 0;
  if (alertDisjoint) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.anyDisjoint);
    droppedNotDisjoint = before - filtered.length;
  }
  let droppedNotCleanChain = 0;
  if (alertCleanChain) {
    const before = filtered.length;
    filtered = filtered.filter(
      (r) => r.cleanChain && r.nestingChainDepth === N_LENSES,
    );
    droppedNotCleanChain = before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiContainmentNestednessRow,
      b: SourceRowTokenSlopeCiContainmentNestednessRow,
    ) => number
  > = {
    'nesting-fraction-desc': (a, b) => b.nestingFraction - a.nestingFraction,
    'nesting-fraction-asc': (a, b) => a.nestingFraction - b.nestingFraction,
    'disjoint-fraction-desc': (a, b) => b.disjointFraction - a.disjointFraction,
    'disjoint-fraction-asc': (a, b) => a.disjointFraction - b.disjointFraction,
    'chain-depth-desc': (a, b) => b.nestingChainDepth - a.nestingChainDepth,
    'chain-depth-asc': (a, b) => a.nestingChainDepth - b.nestingChainDepth,
    'nested-pairs-desc': (a, b) => b.nestedPairs - a.nestedPairs,
    'partial-pairs-desc': (a, b) => b.partialPairs - a.partialPairs,
    'disjoint-pairs-desc': (a, b) => b.disjointPairs - a.disjointPairs,
    'eq-pairs-desc': (a, b) => b.eqPairs - a.eqPairs,
    'widest-contains-desc': (a, b) => b.widestContains - a.widestContains,
    'tightest-contained-by-desc': (a, b) =>
      b.tightestContainedBy - a.tightestContainedBy,
    'mean-width-desc': (a, b) => b.meanWidth - a.meanWidth,
    'width-spread-desc': (a, b) => b.widthSpread - a.widthSpread,
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
    alertDisjoint,
    alertCleanChain,
    top,
    sort,
    totalSources: rows.length + droppedMissingLens,
    totalRowsKept,
    sourcesWithAllLenses: rows.length,
    droppedMissingLens,
    droppedNotDisjoint,
    droppedNotCleanChain,
    droppedBelowTopCap,
    anyDisjointCount,
    cleanChainCount,
    totalOrderCount,
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
 * second line printing the canonical 15-vector of pair relations
 * in `i<j` order over canonical lens order. When `showProfile` is
 * true, a third line prints the per-lens contains/containedBy/
 * equalTo profile in canonical lens order. Either flag is useful
 * for spotting which specific lens dominates the containment
 * structure without having to re-run with --json.
 */
export function renderSourceRowTokenSlopeCiContainmentNestedness(
  r: SourceRowTokenSlopeCiContainmentNestednessReport,
  opts: { showPairs?: boolean; showProfile?: boolean } = {},
): string {
  const showPairs = opts.showPairs ?? false;
  const showProfile = opts.showProfile ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-containment-nestedness');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses}, shown ${r.sources.length})    rows: ${r.totalRowsKept}    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-disjoint: ${r.alertDisjoint ? 'yes' : 'no'}    alert-clean-chain: ${r.alertCleanChain ? 'yes' : 'no'}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedNotDisjoint} not-disjoint (alert), ${r.droppedNotCleanChain} not-clean-chain (alert), ${r.droppedBelowTopCap} below top cap; any-disjoint: ${r.anyDisjointCount}; clean-chain: ${r.cleanChainCount}; total-order (chain==6): ${r.totalOrderCount}`,
  );
  lines.push('');
  if (r.sources.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  EQ/N/P/D    chn  cln  widest              c   tightest             cb   nestF    disjF    meanW       wSpread     anyD',
  );
  lines.push(
    '---------------  ----  ----------  ---  ---  ------------------  --  ------------------  --   ------   ------   ----------  ----------  ----',
  );
  for (const row of r.sources) {
    const cnts = `${row.eqPairs}/${row.nestedPairs}/${row.partialPairs}/${row.disjointPairs}`;
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        cnts.padStart(10),
        String(row.nestingChainDepth).padStart(3),
        (row.cleanChain ? 'yes' : 'NO').padStart(3),
        row.widestLens.padEnd(18),
        String(row.widestContains).padStart(2),
        row.tightestLens.padEnd(18),
        String(row.tightestContainedBy).padStart(2),
        row.nestingFraction.toFixed(4).padStart(6),
        row.disjointFraction.toFixed(4).padStart(6),
        fmtNum(row.meanWidth).padStart(10),
        fmtNum(row.widthSpread).padStart(10),
        (row.anyDisjoint ? 'yes' : 'NO').padStart(4),
      ].join('  '),
    );
    if (showPairs) {
      const parts: string[] = [];
      let k = 0;
      for (let i = 0; i < N_LENSES; i++) {
        for (let j = i + 1; j < N_LENSES; j++) {
          const li = SLOPE_CONTAINMENT_LENS_NAMES[i]!;
          const lj = SLOPE_CONTAINMENT_LENS_NAMES[j]!;
          parts.push(`${li}~${lj}=${row.pairs[k]!}`);
          k += 1;
        }
      }
      lines.push(`                 pairs: ${parts.join('  ')}`);
    }
    if (showProfile) {
      const parts: string[] = [];
      for (let i = 0; i < N_LENSES; i++) {
        const lens = SLOPE_CONTAINMENT_LENS_NAMES[i]!;
        parts.push(
          `${lens}=${row.contains[i]!}/${row.containedBy[i]!}/${row.equalTo[i]!}`,
        );
      }
      lines.push(`                 profile (contains/containedBy/equalTo): ${parts.join('  ')}`);
    }
  }
  return lines.join('\n');
}
