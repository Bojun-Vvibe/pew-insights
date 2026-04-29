/**
 * source-row-token-slope-ci-overlap-graph
 *
 * Graph-topology diagnostic for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six per-source
 * CIs that v0.6.227, v0.6.228, and v0.6.229 consume:
 *
 *   1. percentile bootstrap     (v0.6.220)
 *   2. jackknife normal         (v0.6.221)
 *   3. BCa bootstrap            (v0.6.222)
 *   4. studentized-t bootstrap  (v0.6.223)
 *   5. ABC bootstrap            (v0.6.224)
 *   6. profile-likelihood       (v0.6.225)
 *
 * Mechanically distinct from ALL THREE prior cross-lens diagnostics:
 *
 *   - v0.6.227 measures *Jaccard* over the full 6-lens family —
 *     a single scalar `agreementIndex` averaging 15 pairwise overlap
 *     ratios. Two sources can share the same agreementIndex with
 *     completely different topologies (e.g., 5 lenses tightly clustered
 *     + 1 outlier vs. 3+3 bimodal split).
 *   - v0.6.228 measures *directional* concordance — sign of slope
 *     and CI exclusion of zero, ignoring magnitude entirely.
 *   - v0.6.229 measures *width / precision* concordance — magnitude
 *     of CI widths, ignoring whether they overlap each other.
 *
 * This module measures *graph topology of the overlap relation* —
 * for the 6 lenses per source, build the symmetric undirected graph
 * G with V = {6 lenses}, E = {(i, j) : CI_i ∩ CI_j ≠ ∅, i < j}.
 * Then report:
 *
 *   - `edgeCount` — number of pairwise overlaps (0..15);
 *   - `density` — `edgeCount / 15`, in [0, 1]; 1 == every lens
 *     overlaps every other (the v0.6.227 "consensus" regime);
 *   - `componentCount` — number of connected components of G
 *     (1..6); 1 == one bridge of overlap connects all lenses;
 *   - `largestComponentSize` — size of the biggest component
 *     (1..6);
 *   - `singletonCount` — number of lenses in a 1-element
 *     component (i.e., overlap with NO other lens);
 *   - `singletonLenses` — names of the singleton lenses, in
 *     canonical order;
 *   - `maxCliqueSize` — size of the largest clique (1..6); a
 *     clique of size k means k lenses are pairwise mutually
 *     overlapping (a "consensus pocket"); for k=6 implies
 *     `density == 1`;
 *   - `componentSizes` — sorted-descending vector of all
 *     component sizes (sums to 6);
 *   - `bridgeCount` — number of bridge edges (edges whose
 *     removal disconnects their component); 0 means every
 *     overlap is "redundant" (part of a triangle or larger);
 *   - `triangleCount` — number of triangles (3-cliques) in G,
 *     in [0, 20]; raw count of 3-lens consensus pockets;
 *   - `transitivity` — global clustering coefficient =
 *     `3 * triangleCount / triplet-count` where triplet-count
 *     is the number of paths of length 2 in G; in [0, 1] when
 *     defined, 0 if no triplets exist;
 *   - `consensusBackbone` — boolean true iff `componentCount == 1
 *     && maxCliqueSize >= 4`; a heuristic "the lenses form one
 *     interconnected blob with a 4+ consensus pocket inside" check;
 *   - `fragmented` — boolean true iff `componentCount >= 3`; a
 *     heuristic "the lenses split into 3+ disjoint islands" check.
 *
 * Why this complements the prior three:
 *
 *   - Jaccard (v0.6.227) reports a continuous scalar over all 15
 *     pairs — it loses topology. A graph with edges
 *     {(1,2), (3,4), (5,6)} (3 disjoint pairs) and a graph with
 *     edges {(1,2), (1,3), (1,4)} (a star centered at lens 1) have
 *     the same edgeCount = 3 / density = 0.2 but completely
 *     different componentCount (3 vs 3) and singleton structure
 *     (0 vs 2). This module reports those topological invariants.
 *   - Sign concordance (v0.6.228) is direction-only.
 *   - Width concordance (v0.6.229) is magnitude-only.
 *   - Overlap-graph topology (this) is *which* lenses agree with
 *     *which*, structurally — not how often, how wide, or which way.
 *
 * Per-source we also emit the full 6×6 adjacency matrix
 * (`adjacency`) and the 15-pair edge list (`edges`) for callers
 * that want to render the graph themselves.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_OVERLAP_GRAPH_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeOverlapGraphLensName =
  (typeof SLOPE_OVERLAP_GRAPH_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_OVERLAP_GRAPH_LENS_NAMES.length;
const MAX_EDGES = (N_LENSES * (N_LENSES - 1)) / 2; // 15

export interface SourceRowTokenSlopeCiOverlapGraphOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Drop sources with fewer than this many kept rows. Integer >= 4. */
  minRows?: number;
  /** Confidence level in (0, 1). Default 0.95. */
  confidence?: number;
  /** Variance ratio for the underlying Deming fit. Finite > 0. Default 1. */
  lambda?: number;
  /** Bootstrap replicate count. Integer >= 100. Default 1000. */
  bootstraps?: number;
  /** LCG seed shared across the three resample-based lenses. Default 42. */
  seed?: number;
  /** If true, only emit sources whose graph has componentCount >= 2 (lens island detected). */
  alertFragmented?: boolean;
  /** If true, only emit sources whose graph has at least one singleton lens. */
  alertIsolated?: boolean;
  top?: number | null;
  sort?:
    | 'density-asc'
    | 'density-desc'
    | 'components-desc'
    | 'components-asc'
    | 'singletons-desc'
    | 'singletons-asc'
    | 'max-clique-desc'
    | 'max-clique-asc'
    | 'triangles-desc'
    | 'triangles-asc'
    | 'transitivity-desc'
    | 'transitivity-asc'
  | 'bridges-desc'
  | 'bridges-asc'
  | 'bridge-fraction-desc'
  | 'bridge-fraction-asc'
  | 'graph-signature'
  | 'rows'
  | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiOverlapGraphEdge {
  a: SlopeOverlapGraphLensName;
  b: SlopeOverlapGraphLensName;
}

export interface SourceRowTokenSlopeCiOverlapGraphRow {
  source: string;
  rowsKept: number;
  /** 6×6 boolean adjacency matrix, indexed by lens canonical order. Diagonal is true. */
  adjacency: boolean[][];
  /** Edge list (i < j); undirected; sorted by canonical lens index. */
  edges: SourceRowTokenSlopeCiOverlapGraphEdge[];
  edgeCount: number;
  density: number;
  componentCount: number;
  largestComponentSize: number;
  singletonCount: number;
  singletonLenses: SlopeOverlapGraphLensName[];
  maxCliqueSize: number;
  /** Sorted descending; sums to N_LENSES. */
  componentSizes: number[];
  bridgeCount: number;
  triangleCount: number;
  transitivity: number;
  consensusBackbone: boolean;
  fragmented: boolean;
  /**
   * Stable string fingerprint of the graph's coarse-isomorphism class:
   * `"comp=<sizes-desc-csv>|clique=<k>|tri=<t>|edges=<e>"`. Sources
   * whose overlap graphs are coarsely isomorphic (same component-size
   * vector + same max-clique + same triangle count + same edge count)
   * collide on this key and can be grouped client-side. Cheaper /
   * weaker than full graph6 canonicalisation but sufficient for the
   * 6-vertex regime here.
   */
  graphSignature: string;
  /**
   * `bridgeCount / max(edgeCount, 1)`. Fraction of overlap edges
   * whose removal would split a component. 0 when no bridges
   * (or no edges); 1 when every edge is a bridge (a tree / forest).
   * In [0, 1]. A "robust consensus" graph has low bridgeFraction
   * — its overlaps are reinforced by triangles.
   */
  bridgeFraction: number;
}

export interface SourceRowTokenSlopeCiOverlapGraphReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertFragmented: boolean;
  alertIsolated: boolean;
  top: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiOverlapGraphOptions['sort']>;
  totalSources: number;
  totalRowsKept: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedNotFragmented: number;
  droppedNotIsolated: number;
  droppedBelowTopCap: number;
  /** Number of sources whose componentCount >= 2 (pre-filter). */
  fragmentedCount: number;
  /** Number of sources with at least one singleton lens (pre-filter). */
  isolatedCount: number;
  /** Number of sources whose density == 1 (full overlap consensus; pre-filter). */
  fullConsensusCount: number;
  sources: SourceRowTokenSlopeCiOverlapGraphRow[];
}

const VALID_SORTS = [
  'density-asc',
  'density-desc',
  'components-desc',
  'components-asc',
  'singletons-desc',
  'singletons-asc',
  'max-clique-desc',
  'max-clique-asc',
  'triangles-desc',
  'triangles-asc',
  'transitivity-desc',
  'transitivity-asc',
  'bridges-desc',
  'bridges-asc',
  'bridge-fraction-desc',
  'bridge-fraction-asc',
  'graph-signature',
  'rows',
  'source',
] as const;

/**
 * True iff intervals [aLo, aHi] and [bLo, bHi] (closed) share at
 * least one point. Tolerant of swapped endpoints. Two intervals
 * that touch at a single point (`aHi == bLo`) count as overlapping.
 */
export function intervalsOverlap(
  aLo: number,
  aHi: number,
  bLo: number,
  bHi: number,
): boolean {
  const a0 = Math.min(aLo, aHi);
  const a1 = Math.max(aLo, aHi);
  const b0 = Math.min(bLo, bHi);
  const b1 = Math.max(bLo, bHi);
  if (
    !Number.isFinite(a0) ||
    !Number.isFinite(a1) ||
    !Number.isFinite(b0) ||
    !Number.isFinite(b1)
  ) {
    return false;
  }
  return a0 <= b1 && b0 <= a1;
}

/**
 * Connected-components of a symmetric n×n boolean adjacency matrix
 * (diagonal ignored). Returns an n-vector of component IDs in
 * `[0, k-1]` where k = componentCount.
 */
export function connectedComponents(adj: boolean[][]): number[] {
  const n = adj.length;
  const comp = new Array<number>(n).fill(-1);
  let next = 0;
  for (let s = 0; s < n; s++) {
    if (comp[s] !== -1) continue;
    const stack = [s];
    comp[s] = next;
    while (stack.length) {
      const u = stack.pop()!;
      for (let v = 0; v < n; v++) {
        if (v === u) continue;
        if (adj[u]![v] && comp[v] === -1) {
          comp[v] = next;
          stack.push(v);
        }
      }
    }
    next += 1;
  }
  return comp;
}

/**
 * Largest clique size of a symmetric n×n boolean adjacency matrix
 * (diagonal ignored). Brute-force enumeration over all 2^n subsets.
 * Acceptable here because n is fixed at 6 (64 subsets).
 */
export function maxCliqueSize(adj: boolean[][]): number {
  const n = adj.length;
  let best = n === 0 ? 0 : 1;
  const total = 1 << n;
  for (let mask = 1; mask < total; mask++) {
    const verts: number[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) verts.push(i);
    if (verts.length <= best) continue;
    let isClique = true;
    outer: for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        if (!adj[verts[i]!]![verts[j]!]) {
          isClique = false;
          break outer;
        }
      }
    }
    if (isClique) best = verts.length;
  }
  return best;
}

/**
 * Triangle count of a symmetric n×n boolean adjacency matrix
 * (diagonal ignored). Counts each triangle once.
 */
export function triangleCount(adj: boolean[][]): number {
  const n = adj.length;
  let t = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!adj[i]![j]) continue;
      for (let k = j + 1; k < n; k++) {
        if (adj[i]![k] && adj[j]![k]) t += 1;
      }
    }
  }
  return t;
}

/**
 * Number of length-2 paths (open + closed triplets) centered at
 * each vertex of a symmetric n×n boolean adjacency matrix
 * (diagonal ignored). For a vertex with degree d this contributes
 * `C(d, 2)`. Used as the denominator of global transitivity.
 */
export function tripletCount(adj: boolean[][]): number {
  const n = adj.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let j = 0; j < n; j++) {
      if (j !== i && adj[i]![j]) d += 1;
    }
    total += (d * (d - 1)) / 2;
  }
  return total;
}

/**
 * Bridge edges of a symmetric n×n boolean adjacency matrix
 * (diagonal ignored). An edge `(u, v)` is a bridge iff removing
 * it increases componentCount. Brute-force: try removing every
 * edge and re-run connected components. n=6 makes this trivial.
 */
export function bridgeCount(adj: boolean[][]): number {
  const n = adj.length;
  const baseComps = new Set(connectedComponents(adj)).size;
  let bridges = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!adj[i]![j]) continue;
      // Remove edge (i, j).
      const copy = adj.map((row) => row.slice());
      copy[i]![j] = false;
      copy[j]![i] = false;
      const k = new Set(connectedComponents(copy)).size;
      if (k > baseComps) bridges += 1;
    }
  }
  return bridges;
}

export function buildSourceRowTokenSlopeCiOverlapGraph(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiOverlapGraphOptions = {},
): SourceRowTokenSlopeCiOverlapGraphReport {
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
  const alertFragmented = opts.alertFragmented ?? false;
  const alertIsolated = opts.alertIsolated ?? false;
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'density-asc';
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
  const lensReports: Record<
    SlopeOverlapGraphLensName,
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
  for (const lens of SLOPE_OVERLAP_GRAPH_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_OVERLAP_GRAPH_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }

  const rows: SourceRowTokenSlopeCiOverlapGraphRow[] = [];

  for (const s of sharedSources) {
    const cis: { lo: number; hi: number }[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_OVERLAP_GRAPH_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      cis.push({ lo, hi });
    }

    // Build adjacency. Diagonal = true (each lens overlaps itself).
    const adj: boolean[][] = Array.from({ length: N_LENSES }, () =>
      new Array<boolean>(N_LENSES).fill(false),
    );
    for (let i = 0; i < N_LENSES; i++) adj[i]![i] = true;
    const edges: SourceRowTokenSlopeCiOverlapGraphEdge[] = [];
    let edgeCount = 0;
    for (let i = 0; i < N_LENSES; i++) {
      for (let j = i + 1; j < N_LENSES; j++) {
        const ov = intervalsOverlap(cis[i]!.lo, cis[i]!.hi, cis[j]!.lo, cis[j]!.hi);
        adj[i]![j] = ov;
        adj[j]![i] = ov;
        if (ov) {
          edgeCount += 1;
          edges.push({
            a: SLOPE_OVERLAP_GRAPH_LENS_NAMES[i]!,
            b: SLOPE_OVERLAP_GRAPH_LENS_NAMES[j]!,
          });
        }
      }
    }

    const density = edgeCount / MAX_EDGES;
    const comp = connectedComponents(adj);
    const compSizes: number[] = [];
    {
      const counts = new Map<number, number>();
      for (const c of comp) counts.set(c, (counts.get(c) ?? 0) + 1);
      for (const v of counts.values()) compSizes.push(v);
      compSizes.sort((a, b) => b - a);
    }
    const componentCount = compSizes.length;
    const largestComponentSize = compSizes[0] ?? 0;
    const singletonLenses: SlopeOverlapGraphLensName[] = [];
    {
      const compIdToCount = new Map<number, number>();
      for (const c of comp) compIdToCount.set(c, (compIdToCount.get(c) ?? 0) + 1);
      for (let i = 0; i < N_LENSES; i++) {
        if (compIdToCount.get(comp[i]!) === 1) {
          singletonLenses.push(SLOPE_OVERLAP_GRAPH_LENS_NAMES[i]!);
        }
      }
    }
    const singletonCount = singletonLenses.length;

    const mc = maxCliqueSize(adj);
    const tri = triangleCount(adj);
    const trip = tripletCount(adj);
    const transitivity = trip === 0 ? 0 : (3 * tri) / trip;
    const br = bridgeCount(adj);
    const consensusBackbone = componentCount === 1 && mc >= 4;
    const fragmented = componentCount >= 3;
    const bridgeFraction = edgeCount === 0 ? 0 : br / edgeCount;
    const graphSignature = `comp=${compSizes.join(',')}|clique=${mc}|tri=${tri}|edges=${edgeCount}`;

    rows.push({
      source: s,
      rowsKept,
      adjacency: adj,
      edges,
      edgeCount,
      density,
      componentCount,
      largestComponentSize,
      singletonCount,
      singletonLenses,
      maxCliqueSize: mc,
      componentSizes: compSizes,
      bridgeCount: br,
      triangleCount: tri,
      transitivity,
      consensusBackbone,
      fragmented,
      graphSignature,
      bridgeFraction,
    });
  }

  // Pre-filter aggregates.
  const fragmentedCount = rows.filter((r) => r.componentCount >= 2).length;
  const isolatedCount = rows.filter((r) => r.singletonCount > 0).length;
  const fullConsensusCount = rows.filter((r) => r.density === 1).length;

  let filtered = rows;
  let droppedNotFragmented = 0;
  if (alertFragmented) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.componentCount >= 2);
    droppedNotFragmented = before - filtered.length;
  }
  let droppedNotIsolated = 0;
  if (alertIsolated) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.singletonCount > 0);
    droppedNotIsolated = before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiOverlapGraphRow,
      b: SourceRowTokenSlopeCiOverlapGraphRow,
    ) => number
  > = {
    'density-asc': (a, b) => a.density - b.density,
    'density-desc': (a, b) => b.density - a.density,
    'components-desc': (a, b) => b.componentCount - a.componentCount,
    'components-asc': (a, b) => a.componentCount - b.componentCount,
    'singletons-desc': (a, b) => b.singletonCount - a.singletonCount,
    'singletons-asc': (a, b) => a.singletonCount - b.singletonCount,
    'max-clique-desc': (a, b) => b.maxCliqueSize - a.maxCliqueSize,
    'max-clique-asc': (a, b) => a.maxCliqueSize - b.maxCliqueSize,
    'triangles-desc': (a, b) => b.triangleCount - a.triangleCount,
    'triangles-asc': (a, b) => a.triangleCount - b.triangleCount,
    'transitivity-desc': (a, b) => b.transitivity - a.transitivity,
    'transitivity-asc': (a, b) => a.transitivity - b.transitivity,
    'bridges-desc': (a, b) => b.bridgeCount - a.bridgeCount,
    'bridges-asc': (a, b) => a.bridgeCount - b.bridgeCount,
    'bridge-fraction-desc': (a, b) => b.bridgeFraction - a.bridgeFraction,
    'bridge-fraction-asc': (a, b) => a.bridgeFraction - b.bridgeFraction,
    'graph-signature': (a, b) => a.graphSignature.localeCompare(b.graphSignature),
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
    alertFragmented,
    alertIsolated,
    top,
    sort,
    totalSources: rows.length + droppedMissingLens,
    totalRowsKept,
    sourcesWithAllLenses: rows.length,
    droppedMissingLens,
    droppedNotFragmented,
    droppedNotIsolated,
    droppedBelowTopCap,
    fragmentedCount,
    isolatedCount,
    fullConsensusCount,
    sources: filtered,
  };
}

/**
 * Plain-text renderer. Self-contained, no chalk dependency.
 */
export function renderSourceRowTokenSlopeCiOverlapGraph(
  r: SourceRowTokenSlopeCiOverlapGraphReport,
): string {
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-overlap-graph');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses}, shown ${r.sources.length})    rows: ${r.totalRowsKept}    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-fragmented: ${r.alertFragmented ? 'yes' : 'no'}    alert-isolated: ${r.alertIsolated ? 'yes' : 'no'}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedNotFragmented} not-fragmented (alert), ${r.droppedNotIsolated} not-isolated (alert), ${r.droppedBelowTopCap} below top cap; fragmented: ${r.fragmentedCount}; isolated: ${r.isolatedCount}; full-consensus: ${r.fullConsensusCount}`,
  );
  lines.push('');
  if (r.sources.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  edges/15  density  comps  largest  singles  maxClq  tri  trans   bridges  brFrac  compSizes      backbone  fragm  signature',
  );
  lines.push(
    '---------------  ----  --------  -------  -----  -------  -------  ------  ---  ------  -------  ------  -------------  --------  -----  -----------------------------------',
  );
  for (const row of r.sources) {
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        `${row.edgeCount}/15`.padStart(8),
        row.density.toFixed(4).padStart(7),
        String(row.componentCount).padStart(5),
        String(row.largestComponentSize).padStart(7),
        String(row.singletonCount).padStart(7),
        String(row.maxCliqueSize).padStart(6),
        String(row.triangleCount).padStart(3),
        row.transitivity.toFixed(4).padStart(6),
        String(row.bridgeCount).padStart(7),
        row.bridgeFraction.toFixed(3).padStart(6),
        row.componentSizes.join(',').padEnd(13),
        (row.consensusBackbone ? 'yes' : 'NO').padStart(8),
        (row.fragmented ? 'yes' : 'NO').padStart(5),
        row.graphSignature.padEnd(35),
      ].join('  '),
    );
  }
  return lines.join('\n');
}
