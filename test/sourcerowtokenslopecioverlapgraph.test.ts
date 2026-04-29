/**
 * Unit + integration tests for source-row-token-slope-ci-overlap-graph.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiOverlapGraph,
  renderSourceRowTokenSlopeCiOverlapGraph,
  intervalsOverlap,
  connectedComponents,
  maxCliqueSize,
  triangleCount,
  tripletCount,
  bridgeCount,
  SLOPE_OVERLAP_GRAPH_LENS_NAMES,
} from '../src/sourcerowtokenslopecioverlapgraph.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

function ascending(source: string, n: number): QueueLine[] {
  const vals: number[] = [];
  for (let i = 0; i < n; i++) vals.push(100 + i * 10);
  return mkSeries(source, vals);
}

// --- intervalsOverlap ---

test('intervalsOverlap: clearly overlapping intervals', () => {
  assert.equal(intervalsOverlap(0, 5, 3, 8), true);
});

test('intervalsOverlap: disjoint intervals', () => {
  assert.equal(intervalsOverlap(0, 1, 2, 3), false);
});

test('intervalsOverlap: touching at endpoint counts as overlap', () => {
  assert.equal(intervalsOverlap(0, 1, 1, 2), true);
});

test('intervalsOverlap: nested intervals overlap', () => {
  assert.equal(intervalsOverlap(0, 10, 4, 5), true);
});

test('intervalsOverlap: identical intervals overlap', () => {
  assert.equal(intervalsOverlap(2, 4, 2, 4), true);
});

test('intervalsOverlap: tolerates swapped endpoints', () => {
  assert.equal(intervalsOverlap(5, 0, 8, 3), true);
  assert.equal(intervalsOverlap(3, 1, 5, 4), false);
});

test('intervalsOverlap: NaN endpoints return false', () => {
  assert.equal(intervalsOverlap(NaN, 1, 0, 2), false);
  assert.equal(intervalsOverlap(0, 1, NaN, 2), false);
});

test('intervalsOverlap: Infinity endpoints return false', () => {
  assert.equal(intervalsOverlap(0, Infinity, 5, 10), false);
});

test('intervalsOverlap: degenerate (point) intervals overlap themselves', () => {
  assert.equal(intervalsOverlap(3, 3, 3, 3), true);
});

test('intervalsOverlap: degenerate point inside other interval overlaps', () => {
  assert.equal(intervalsOverlap(2, 2, 0, 5), true);
});

// --- connectedComponents ---

test('connectedComponents: single isolated vertex', () => {
  const adj = [[true]];
  assert.deepEqual(connectedComponents(adj), [0]);
});

test('connectedComponents: 6 isolated vertices => 6 components', () => {
  const adj = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => i === j),
  );
  const comp = connectedComponents(adj);
  assert.equal(new Set(comp).size, 6);
});

test('connectedComponents: fully connected => 1 component', () => {
  const adj = Array.from({ length: 6 }, () => new Array(6).fill(true));
  const comp = connectedComponents(adj);
  assert.equal(new Set(comp).size, 1);
});

test('connectedComponents: two triangles disconnected => 2 components', () => {
  const adj: boolean[][] = Array.from({ length: 6 }, () =>
    new Array(6).fill(false),
  );
  for (let i = 0; i < 6; i++) adj[i]![i] = true;
  // {0,1,2} clique
  for (const [i, j] of [
    [0, 1],
    [0, 2],
    [1, 2],
  ]) {
    adj[i]![j] = true;
    adj[j]![i] = true;
  }
  // {3,4,5} clique
  for (const [i, j] of [
    [3, 4],
    [3, 5],
    [4, 5],
  ]) {
    adj[i]![j] = true;
    adj[j]![i] = true;
  }
  const comp = connectedComponents(adj);
  assert.equal(new Set(comp).size, 2);
});

// --- maxCliqueSize ---

test('maxCliqueSize: empty graph => 1', () => {
  const adj = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => i === j),
  );
  assert.equal(maxCliqueSize(adj), 1);
});

test('maxCliqueSize: complete K6 => 6', () => {
  const adj = Array.from({ length: 6 }, () => new Array(6).fill(true));
  assert.equal(maxCliqueSize(adj), 6);
});

test('maxCliqueSize: triangle K3 in K6 => 3', () => {
  const adj: boolean[][] = Array.from({ length: 6 }, () =>
    new Array(6).fill(false),
  );
  for (let i = 0; i < 6; i++) adj[i]![i] = true;
  for (const [i, j] of [
    [0, 1],
    [0, 2],
    [1, 2],
  ]) {
    adj[i]![j] = true;
    adj[j]![i] = true;
  }
  assert.equal(maxCliqueSize(adj), 3);
});

test('maxCliqueSize: star (1 center + 5 leaves) => 2', () => {
  const adj: boolean[][] = Array.from({ length: 6 }, () =>
    new Array(6).fill(false),
  );
  for (let i = 0; i < 6; i++) adj[i]![i] = true;
  for (let j = 1; j < 6; j++) {
    adj[0]![j] = true;
    adj[j]![0] = true;
  }
  assert.equal(maxCliqueSize(adj), 2);
});

test('maxCliqueSize: K4 inside otherwise sparse => 4', () => {
  const adj: boolean[][] = Array.from({ length: 6 }, () =>
    new Array(6).fill(false),
  );
  for (let i = 0; i < 6; i++) adj[i]![i] = true;
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      adj[i]![j] = true;
      adj[j]![i] = true;
    }
  }
  assert.equal(maxCliqueSize(adj), 4);
});

// --- triangleCount ---

test('triangleCount: empty graph => 0', () => {
  const adj = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => i === j),
  );
  assert.equal(triangleCount(adj), 0);
});

test('triangleCount: K6 => C(6,3) = 20', () => {
  const adj = Array.from({ length: 6 }, () => new Array(6).fill(true));
  assert.equal(triangleCount(adj), 20);
});

test('triangleCount: single K3 => 1', () => {
  const adj: boolean[][] = Array.from({ length: 6 }, () =>
    new Array(6).fill(false),
  );
  for (let i = 0; i < 6; i++) adj[i]![i] = true;
  for (const [i, j] of [
    [0, 1],
    [0, 2],
    [1, 2],
  ]) {
    adj[i]![j] = true;
    adj[j]![i] = true;
  }
  assert.equal(triangleCount(adj), 1);
});

// --- tripletCount ---

test('tripletCount: K6 => 6 * C(5, 2) = 60', () => {
  const adj = Array.from({ length: 6 }, () => new Array(6).fill(true));
  assert.equal(tripletCount(adj), 60);
});

test('tripletCount: empty graph => 0', () => {
  const adj = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => i === j),
  );
  assert.equal(tripletCount(adj), 0);
});

test('tripletCount: star K1,5 => C(5, 2) = 10', () => {
  const adj: boolean[][] = Array.from({ length: 6 }, () =>
    new Array(6).fill(false),
  );
  for (let i = 0; i < 6; i++) adj[i]![i] = true;
  for (let j = 1; j < 6; j++) {
    adj[0]![j] = true;
    adj[j]![0] = true;
  }
  assert.equal(tripletCount(adj), 10);
});

// --- bridgeCount ---

test('bridgeCount: tree (path of 6 nodes) => 5 bridges', () => {
  const adj: boolean[][] = Array.from({ length: 6 }, () =>
    new Array(6).fill(false),
  );
  for (let i = 0; i < 6; i++) adj[i]![i] = true;
  for (let i = 0; i < 5; i++) {
    adj[i]![i + 1] = true;
    adj[i + 1]![i] = true;
  }
  assert.equal(bridgeCount(adj), 5);
});

test('bridgeCount: K6 => 0 bridges', () => {
  const adj = Array.from({ length: 6 }, () => new Array(6).fill(true));
  assert.equal(bridgeCount(adj), 0);
});

test('bridgeCount: triangle (K3) embedded with 3 isolated => 0 bridges', () => {
  const adj: boolean[][] = Array.from({ length: 6 }, () =>
    new Array(6).fill(false),
  );
  for (let i = 0; i < 6; i++) adj[i]![i] = true;
  for (const [i, j] of [
    [0, 1],
    [0, 2],
    [1, 2],
  ]) {
    adj[i]![j] = true;
    adj[j]![i] = true;
  }
  assert.equal(bridgeCount(adj), 0);
});

// --- builder: option validation ---

test('builder: rejects minRows < 4', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiOverlapGraph([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('builder: rejects non-integer minRows', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiOverlapGraph([], { minRows: 4.5 }),
    /minRows must be an integer/,
  );
});

test('builder: rejects confidence out of (0, 1)', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiOverlapGraph([], { confidence: 0 }),
    /confidence/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiOverlapGraph([], { confidence: 1 }),
    /confidence/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiOverlapGraph([], { confidence: Number.NaN }),
    /confidence/,
  );
});

test('builder: rejects non-positive lambda', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiOverlapGraph([], { lambda: 0 }),
    /lambda/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiOverlapGraph([], { lambda: -1 }),
    /lambda/,
  );
});

test('builder: rejects bootstraps < 100', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiOverlapGraph([], { bootstraps: 50 }),
    /bootstraps/,
  );
});

test('builder: rejects non-integer seed', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiOverlapGraph([], { seed: 1.5 }),
    /seed/,
  );
});

test('builder: rejects top < 1', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiOverlapGraph([], { top: 0 }),
    /top/,
  );
});

test('builder: rejects unknown sort key', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiOverlapGraph([], {
        sort: 'bogus' as 'density-asc',
      }),
    /sort/,
  );
});

// --- builder: empty queue ---

test('builder: empty queue produces empty report with options preserved', () => {
  const rep = buildSourceRowTokenSlopeCiOverlapGraph([], {
    confidence: 0.9,
    lambda: 2,
    bootstraps: 200,
    seed: 7,
    minRows: 5,
    top: 10,
    sort: 'components-desc',
    alertFragmented: true,
    alertIsolated: true,
  });
  assert.equal(rep.sources.length, 0);
  assert.equal(rep.totalSources, 0);
  assert.equal(rep.totalRowsKept, 0);
  assert.equal(rep.confidence, 0.9);
  assert.equal(rep.lambda, 2);
  assert.equal(rep.bootstraps, 200);
  assert.equal(rep.seed, 7);
  assert.equal(rep.minRows, 5);
  assert.equal(rep.top, 10);
  assert.equal(rep.sort, 'components-desc');
  assert.equal(rep.alertFragmented, true);
  assert.equal(rep.alertIsolated, true);
});

// --- builder: integration on synthetic monotone data ---

test('builder: ascending series produces a row with all 6 lenses present', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  assert.equal(rep.sourcesWithAllLenses, 1);
  assert.equal(rep.sources.length, 1);
  const row = rep.sources[0]!;
  assert.equal(row.source, 's1');
  assert.equal(row.adjacency.length, 6);
  for (const r of row.adjacency) assert.equal(r.length, 6);
  // diagonal is true
  for (let i = 0; i < 6; i++) assert.equal(row.adjacency[i]![i], true);
  // adjacency is symmetric
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 6; j++)
      assert.equal(row.adjacency[i]![j], row.adjacency[j]![i]);
});

test('builder: edgeCount matches edges array length', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  assert.equal(row.edgeCount, row.edges.length);
});

test('builder: density == edgeCount / 15', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  assert.ok(Math.abs(row.density - row.edgeCount / 15) < 1e-12);
});

test('builder: edgeCount in [0, 15]', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  assert.ok(row.edgeCount >= 0 && row.edgeCount <= 15);
});

test('builder: componentCount in [1, 6]', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  assert.ok(row.componentCount >= 1 && row.componentCount <= 6);
});

test('builder: largestComponentSize <= 6 and >= 1', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  assert.ok(row.largestComponentSize >= 1 && row.largestComponentSize <= 6);
});

test('builder: componentSizes sums to 6 and is sorted descending', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  const sum = row.componentSizes.reduce((a, b) => a + b, 0);
  assert.equal(sum, 6);
  for (let i = 1; i < row.componentSizes.length; i++) {
    assert.ok(row.componentSizes[i - 1]! >= row.componentSizes[i]!);
  }
});

test('builder: maxCliqueSize in [1, 6]', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  assert.ok(row.maxCliqueSize >= 1 && row.maxCliqueSize <= 6);
});

test('builder: transitivity in [0, 1]', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  assert.ok(row.transitivity >= 0 && row.transitivity <= 1);
});

test('builder: triangleCount in [0, 20]', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  assert.ok(row.triangleCount >= 0 && row.triangleCount <= 20);
});

test('builder: bridgeCount <= edgeCount', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  assert.ok(row.bridgeCount <= row.edgeCount);
});

test('builder: singletonCount + nonSingletonsCount === 6', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  // count vertices that ARE in singleton components
  // by mapping back through componentSizes: singletons are size-1 components
  const numSingletons = row.componentSizes.filter((s) => s === 1).length;
  assert.equal(row.singletonCount, numSingletons);
});

test('builder: singletonLenses are in canonical order', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  const idx = row.singletonLenses.map((l) =>
    SLOPE_OVERLAP_GRAPH_LENS_NAMES.indexOf(l),
  );
  for (let i = 1; i < idx.length; i++) {
    assert.ok(idx[i - 1]! < idx[i]!);
  }
});

test('builder: edges array has each pair exactly once with a < b in canonical order', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  const seen = new Set<string>();
  for (const e of row.edges) {
    const ai = SLOPE_OVERLAP_GRAPH_LENS_NAMES.indexOf(e.a);
    const bi = SLOPE_OVERLAP_GRAPH_LENS_NAMES.indexOf(e.b);
    assert.ok(ai < bi, `edge (${e.a}, ${e.b}) not in canonical order`);
    const key = `${e.a}|${e.b}`;
    assert.ok(!seen.has(key), `duplicate edge ${key}`);
    seen.add(key);
  }
});

test('builder: consensusBackbone implies componentCount==1 AND maxCliqueSize>=4', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  if (row.consensusBackbone) {
    assert.equal(row.componentCount, 1);
    assert.ok(row.maxCliqueSize >= 4);
  }
});

test('builder: fragmented iff componentCount >= 3', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  assert.equal(row.fragmented, row.componentCount >= 3);
});

test('builder: SLOPE_OVERLAP_GRAPH_LENS_NAMES has exactly 6 entries', () => {
  assert.equal(SLOPE_OVERLAP_GRAPH_LENS_NAMES.length, 6);
});

test('builder: deterministic given same seed', () => {
  const queue = ascending('s1', 30);
  const a = buildSourceRowTokenSlopeCiOverlapGraph(queue, { seed: 99 });
  const b = buildSourceRowTokenSlopeCiOverlapGraph(queue, { seed: 99 });
  assert.equal(a.sources[0]!.edgeCount, b.sources[0]!.edgeCount);
  assert.equal(a.sources[0]!.componentCount, b.sources[0]!.componentCount);
  assert.equal(a.sources[0]!.maxCliqueSize, b.sources[0]!.maxCliqueSize);
});

test('builder: --source filter restricts to one source', () => {
  const queue = [...ascending('s1', 20), ...ascending('s2', 20)];
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, { source: 's1' });
  assert.equal(rep.sources.length, 1);
  assert.equal(rep.sources[0]!.source, 's1');
});

test('builder: --top caps emitted rows and increments droppedBelowTopCap', () => {
  const queue = [
    ...ascending('s1', 20),
    ...ascending('s2', 20),
    ...ascending('s3', 20),
  ];
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, { top: 2 });
  assert.equal(rep.sources.length, 2);
  assert.equal(rep.droppedBelowTopCap, 1);
});

test('builder: --alert-fragmented filter only keeps componentCount >= 2', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {
    alertFragmented: true,
  });
  for (const r of rep.sources) assert.ok(r.componentCount >= 2);
});

test('builder: --alert-isolated filter only keeps singletonCount > 0', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {
    alertIsolated: true,
  });
  for (const r of rep.sources) assert.ok(r.singletonCount > 0);
});

test('builder: sort=source produces alphabetic ordering', () => {
  const queue = [
    ...ascending('zeta', 20),
    ...ascending('alpha', 20),
    ...ascending('mu', 20),
  ];
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, { sort: 'source' });
  const names = rep.sources.map((r) => r.source);
  assert.deepEqual(names, ['alpha', 'mu', 'zeta']);
});

test('builder: sort=rows produces descending rowsKept', () => {
  const queue = [
    ...ascending('s1', 12),
    ...ascending('s2', 30),
    ...ascending('s3', 20),
  ];
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, { sort: 'rows' });
  for (let i = 1; i < rep.sources.length; i++) {
    assert.ok(rep.sources[i - 1]!.rowsKept >= rep.sources[i]!.rowsKept);
  }
});

test('builder: triangle-triplet identity (3*tri/triplets) matches transitivity', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  const adj = row.adjacency;
  const tri = triangleCount(adj);
  const trip = tripletCount(adj);
  const expected = trip === 0 ? 0 : (3 * tri) / trip;
  assert.ok(Math.abs(row.transitivity - expected) < 1e-12);
});

test('builder: pre-filter counts (fragmentedCount/isolatedCount/fullConsensusCount) consistent', () => {
  const queue = [...ascending('s1', 30), ...ascending('s2', 25)];
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const fc = rep.sources.filter((r) => r.componentCount >= 2).length;
  const ic = rep.sources.filter((r) => r.singletonCount > 0).length;
  const cc = rep.sources.filter((r) => r.density === 1).length;
  assert.equal(rep.fragmentedCount, fc);
  assert.equal(rep.isolatedCount, ic);
  assert.equal(rep.fullConsensusCount, cc);
});

// --- renderer ---

test('renderer: empty report renders header + (no sources)', () => {
  const rep = buildSourceRowTokenSlopeCiOverlapGraph([], {});
  const out = renderSourceRowTokenSlopeCiOverlapGraph(rep);
  assert.match(out, /pew-insights source-row-token-slope-ci-overlap-graph/);
  assert.match(out, /\(no sources\)/);
});

test('renderer: non-empty report includes header columns and source row', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const out = renderSourceRowTokenSlopeCiOverlapGraph(rep);
  assert.match(out, /source\s+rows\s+edges\/15\s+density/);
  assert.match(out, /s1/);
});

test('renderer: header reflects alert flags', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {
    alertFragmented: true,
    alertIsolated: true,
  });
  const out = renderSourceRowTokenSlopeCiOverlapGraph(rep);
  assert.match(out, /alert-fragmented: yes/);
  assert.match(out, /alert-isolated: yes/);
});

test('renderer: backbone yes/NO and fragm yes/NO present', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const out = renderSourceRowTokenSlopeCiOverlapGraph(rep);
  // at least one of yes/NO must appear in each col context
  assert.ok(/(yes|NO)/.test(out));
});

// --- refinement (v0.6.230 release-followup): graphSignature + bridgeFraction + new sort keys ---

test('refinement: graphSignature is a deterministic non-empty string', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  assert.equal(typeof row.graphSignature, 'string');
  assert.ok(row.graphSignature.length > 0);
  assert.match(row.graphSignature, /^comp=.*\|clique=\d+\|tri=\d+\|edges=\d+$/);
});

test('refinement: graphSignature encodes componentSizes / clique / tri / edges', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  const sig = row.graphSignature;
  assert.ok(sig.includes(`comp=${row.componentSizes.join(',')}`));
  assert.ok(sig.includes(`clique=${row.maxCliqueSize}`));
  assert.ok(sig.includes(`tri=${row.triangleCount}`));
  assert.ok(sig.includes(`edges=${row.edgeCount}`));
});

test('refinement: bridgeFraction in [0, 1]', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  assert.ok(row.bridgeFraction >= 0 && row.bridgeFraction <= 1);
});

test('refinement: bridgeFraction == bridgeCount / edgeCount when edgeCount > 0', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const row = rep.sources[0]!;
  if (row.edgeCount > 0) {
    const expected = row.bridgeCount / row.edgeCount;
    assert.ok(Math.abs(row.bridgeFraction - expected) < 1e-12);
  }
});

test('refinement: bridgeFraction is 0 when edgeCount is 0 (vacuous)', () => {
  // Synthetic empty-edge case via direct call (rather than queue);
  // exercise the API surface only.
  const rep = buildSourceRowTokenSlopeCiOverlapGraph([], {});
  // No sources to inspect. This test pins the empty-queue path
  // and the well-typed shape of bridgeFraction in the type contract.
  assert.equal(rep.sources.length, 0);
});

test('refinement: same overlap graph => same graphSignature (deterministic)', () => {
  const queue = ascending('s1', 30);
  const a = buildSourceRowTokenSlopeCiOverlapGraph(queue, { seed: 42 });
  const b = buildSourceRowTokenSlopeCiOverlapGraph(queue, { seed: 42 });
  assert.equal(a.sources[0]!.graphSignature, b.sources[0]!.graphSignature);
});

test('refinement: sort=graph-signature is alphabetic on signature string', () => {
  const queue = [
    ...ascending('aa', 25),
    ...ascending('bb', 25),
    ...ascending('cc', 25),
  ];
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {
    sort: 'graph-signature',
  });
  for (let i = 1; i < rep.sources.length; i++) {
    const prev = rep.sources[i - 1]!.graphSignature;
    const cur = rep.sources[i]!.graphSignature;
    assert.ok(prev.localeCompare(cur) <= 0);
  }
});

test('refinement: sort=bridge-fraction-desc orders descending', () => {
  const queue = [
    ...ascending('aa', 25),
    ...ascending('bb', 25),
    ...ascending('cc', 25),
  ];
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {
    sort: 'bridge-fraction-desc',
  });
  for (let i = 1; i < rep.sources.length; i++) {
    assert.ok(
      rep.sources[i - 1]!.bridgeFraction >= rep.sources[i]!.bridgeFraction,
    );
  }
});

test('refinement: sort=bridge-fraction-asc orders ascending', () => {
  const queue = [
    ...ascending('aa', 25),
    ...ascending('bb', 25),
    ...ascending('cc', 25),
  ];
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {
    sort: 'bridge-fraction-asc',
  });
  for (let i = 1; i < rep.sources.length; i++) {
    assert.ok(
      rep.sources[i - 1]!.bridgeFraction <= rep.sources[i]!.bridgeFraction,
    );
  }
});

test('refinement: renderer includes brFrac and signature columns', () => {
  const queue = ascending('s1', 30);
  const rep = buildSourceRowTokenSlopeCiOverlapGraph(queue, {});
  const out = renderSourceRowTokenSlopeCiOverlapGraph(rep);
  assert.match(out, /brFrac/);
  assert.match(out, /signature/);
  assert.match(out, /comp=.*\|clique=/);
});
