/**
 * Unit + integration tests for source-row-token-slope-ci-coverage-volume.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiCoverageVolume,
  renderSourceRowTokenSlopeCiCoverageVolume,
  coveragePair,
  SLOPE_COVERAGE_LENS_NAMES,
} from '../src/sourcerowtokenslopecicoveragevolume.js';
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

function ascending(source: string, n: number, slope = 10, base = 100): QueueLine[] {
  const vals: number[] = [];
  for (let i = 0; i < n; i++) vals.push(base + i * slope);
  return mkSeries(source, vals);
}

// --- coveragePair pure helper ---

test('coveragePair: identical intervals -> iou=1, containment=1, overlap=union', () => {
  const r = coveragePair(0, 10, 0, 10);
  assert.equal(r.iou, 1);
  assert.equal(r.containmentRatio, 1);
  assert.equal(r.overlap, 10);
  assert.equal(r.union, 10);
});

test('coveragePair: A strictly inside B -> iou=|A|/|B|, containment=1', () => {
  const r = coveragePair(2, 4, 0, 10);
  assert.equal(r.overlap, 2);
  assert.equal(r.union, 10);
  assert.equal(r.iou, 0.2);
  assert.equal(r.containmentRatio, 1);
});

test('coveragePair: B strictly inside A -> mirror of A_in_B', () => {
  const r = coveragePair(0, 10, 2, 4);
  assert.equal(r.overlap, 2);
  assert.equal(r.union, 10);
  assert.equal(r.iou, 0.2);
  assert.equal(r.containmentRatio, 1);
});

test('coveragePair: half-overlap -> iou=overlap/union', () => {
  // [0,10] vs [5,15] -> overlap=5, hull=15
  const r = coveragePair(0, 10, 5, 15);
  assert.equal(r.overlap, 5);
  assert.equal(r.union, 15);
  assert.equal(r.iou, 5 / 15);
  assert.equal(r.containmentRatio, 0.5);
});

test('coveragePair: just touching at one point -> overlap=0, iou=0 (sets share measure-zero)', () => {
  const r = coveragePair(0, 5, 5, 10);
  assert.equal(r.overlap, 0);
  assert.equal(r.union, 10);
  assert.equal(r.iou, 0);
  assert.equal(r.containmentRatio, 0);
});

test('coveragePair: disjoint with gap -> iou=0, union=outer-hull length (NOT sum + gap)', () => {
  const r = coveragePair(0, 5, 10, 15);
  assert.equal(r.overlap, 0);
  assert.equal(r.union, 15); // hull = 15-0
  assert.equal(r.iou, 0);
  assert.equal(r.containmentRatio, 0);
});

test('coveragePair: outer-hull union is monotone in separation', () => {
  // (intentional doc-of-behaviour) iou strictly decreases as B drifts right of A
  const a = coveragePair(0, 5, 6, 11);
  const b = coveragePair(0, 5, 8, 13);
  const c = coveragePair(0, 5, 12, 17);
  assert.equal(a.iou, 0);
  assert.equal(b.iou, 0);
  assert.equal(c.iou, 0);
  // unions grow strictly
  assert.ok(a.union < b.union);
  assert.ok(b.union < c.union);
});

test('coveragePair: degenerate point CI inside other -> iou=0 but containment=1', () => {
  // |A| = 0, A inside B
  const r = coveragePair(3, 3, 0, 10);
  assert.equal(r.overlap, 0);
  assert.equal(r.union, 10);
  assert.equal(r.iou, 0);
  assert.equal(r.containmentRatio, 1);
});

test('coveragePair: degenerate point CI outside other -> iou=0, containment=0', () => {
  const r = coveragePair(20, 20, 0, 10);
  assert.equal(r.overlap, 0);
  assert.equal(r.union, 20);
  assert.equal(r.iou, 0);
  assert.equal(r.containmentRatio, 0);
});

test('coveragePair: two identical zero-length points -> iou=1, containment=1', () => {
  const r = coveragePair(7, 7, 7, 7);
  assert.equal(r.overlap, 0);
  assert.equal(r.union, 0);
  assert.equal(r.iou, 1);
  assert.equal(r.containmentRatio, 1);
});

test('coveragePair: two distinct zero-length points -> iou=0, containment=0', () => {
  const r = coveragePair(3, 3, 5, 5);
  assert.equal(r.overlap, 0);
  assert.equal(r.union, 2);
  assert.equal(r.iou, 0);
  assert.equal(r.containmentRatio, 0);
});

test('coveragePair: zero-length point on the boundary lo of other -> containment=1', () => {
  const r = coveragePair(0, 0, 0, 10);
  assert.equal(r.containmentRatio, 1);
});

test('coveragePair: zero-length point on the boundary hi of other -> containment=1', () => {
  const r = coveragePair(10, 10, 0, 10);
  assert.equal(r.containmentRatio, 1);
});

test('coveragePair: throws on NaN endpoint A.lo', () => {
  assert.throws(() => coveragePair(NaN, 1, 0, 1), /non-finite/);
});

test('coveragePair: throws on NaN endpoint A.hi', () => {
  assert.throws(() => coveragePair(0, NaN, 0, 1), /non-finite/);
});

test('coveragePair: throws on NaN endpoint B.lo', () => {
  assert.throws(() => coveragePair(0, 1, NaN, 1), /non-finite/);
});

test('coveragePair: throws on NaN endpoint B.hi', () => {
  assert.throws(() => coveragePair(0, 1, 0, NaN), /non-finite/);
});

test('coveragePair: throws on Infinity endpoint', () => {
  assert.throws(() => coveragePair(0, Infinity, 0, 1), /non-finite/);
});

test('coveragePair: throws on -Infinity endpoint', () => {
  assert.throws(() => coveragePair(-Infinity, 0, 0, 1), /non-finite/);
});

test('coveragePair: throws on ill-formed A (lo > hi)', () => {
  assert.throws(() => coveragePair(5, 3, 0, 10), /A is ill-formed/);
});

test('coveragePair: throws on ill-formed B (lo > hi)', () => {
  assert.throws(() => coveragePair(0, 10, 7, 3), /B is ill-formed/);
});

test('coveragePair: iou is symmetric in arguments', () => {
  const ab = coveragePair(0, 7, 3, 11);
  const ba = coveragePair(3, 11, 0, 7);
  assert.equal(ab.iou, ba.iou);
  assert.equal(ab.overlap, ba.overlap);
  assert.equal(ab.union, ba.union);
  assert.equal(ab.containmentRatio, ba.containmentRatio);
});

test('coveragePair: tightly nested (containment=1, iou < 1) is distinguishable from side-by-side', () => {
  const nested = coveragePair(2, 3, 0, 10);
  const sideBySide = coveragePair(0, 5, 5 - 1, 10 - 1);
  assert.equal(nested.containmentRatio, 1);
  assert.ok(nested.iou < 1);
  // side-by-side: containment = overlap / min(|A|, |B|) = 4 / 5 = 0.8, NOT 1
  assert.ok(sideBySide.containmentRatio < 1);
});

test('coveragePair: iou always in [0, 1]', () => {
  // randomized smoke
  let seed = 1;
  function rng() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }
  for (let i = 0; i < 200; i++) {
    const a0 = rng() * 10 - 5;
    const a1 = a0 + rng() * 5;
    const b0 = rng() * 10 - 5;
    const b1 = b0 + rng() * 5;
    const r = coveragePair(a0, a1, b0, b1);
    assert.ok(r.iou >= 0 && r.iou <= 1, `iou out of [0,1]: ${r.iou}`);
    assert.ok(
      r.containmentRatio >= 0 && r.containmentRatio <= 1,
      `containment out of [0,1]: ${r.containmentRatio}`,
    );
    assert.ok(r.overlap >= 0);
    assert.ok(r.union >= 0);
  }
});

// --- option validation ---

test('build: throws on minRows < 4', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiCoverageVolume([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('build: throws on non-integer minRows', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiCoverageVolume([], { minRows: 4.5 }),
    /minRows must be an integer/,
  );
});

test('build: throws on confidence <= 0', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiCoverageVolume([], { confidence: 0 }),
    /confidence must be a finite number in \(0, 1\)/,
  );
});

test('build: throws on confidence >= 1', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiCoverageVolume([], { confidence: 1 }),
    /confidence must be a finite number in \(0, 1\)/,
  );
});

test('build: throws on negative lambda', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiCoverageVolume([], { lambda: -1 }),
    /lambda must be a finite, strictly positive number/,
  );
});

test('build: throws on zero lambda', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiCoverageVolume([], { lambda: 0 }),
    /lambda must be a finite, strictly positive number/,
  );
});

test('build: throws on bootstraps < 100', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiCoverageVolume([], { bootstraps: 50 }),
    /bootstraps must be an integer >= 100/,
  );
});

test('build: throws on non-integer seed', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiCoverageVolume([], { seed: 1.5 }),
    /seed must be an integer/,
  );
});

test('build: throws on weakIouThreshold < 0', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiCoverageVolume([], { weakIouThreshold: -0.1 }),
    /weakIouThreshold must be a finite number in \[0, 1\]/,
  );
});

test('build: throws on weakIouThreshold > 1', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiCoverageVolume([], { weakIouThreshold: 1.5 }),
    /weakIouThreshold must be a finite number in \[0, 1\]/,
  );
});

test('build: throws on strongIouThreshold > 1', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiCoverageVolume([], { strongIouThreshold: 1.5 }),
    /strongIouThreshold must be a finite number in \[0, 1\]/,
  );
});

test('build: throws when strongIouThreshold < weakIouThreshold', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiCoverageVolume([], {
        weakIouThreshold: 0.7,
        strongIouThreshold: 0.5,
      }),
    /strongIouThreshold .* must be >= weakIouThreshold/,
  );
});

test('build: throws on alertWeakMean out of [0, 1]', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiCoverageVolume([], { alertWeakMean: 1.1 }),
    /alertWeakMean must be a finite number in \[0, 1\]/,
  );
});

test('build: throws on alertWeakMean = NaN', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiCoverageVolume([], { alertWeakMean: NaN }),
    /alertWeakMean must be a finite number in \[0, 1\]/,
  );
});

test('build: throws on top < 1', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiCoverageVolume([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('build: throws on non-integer top', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiCoverageVolume([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('build: throws on unknown sort key', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiCoverageVolume([], {
        sort: 'bogus' as 'coherence-desc',
      }),
    /sort must be one of/,
  );
});

// --- empty / minimal data ---

test('build: empty queue -> zero sources, well-formed report', () => {
  const r = buildSourceRowTokenSlopeCiCoverageVolume([], {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.droppedMissingLens, 0);
  assert.equal(r.weakMeanIouCount, 0);
  assert.equal(r.strongMeanIouCount, 0);
  assert.equal(r.anyDisjointCount, 0);
  assert.equal(r.meanCoherenceScore, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.confidence, 0.95);
  assert.equal(r.weakIouThreshold, 0.5);
  assert.equal(r.strongIouThreshold, 0.9);
  assert.equal(r.sort, 'coherence-desc');
});

test('build: single-source ascending series produces 15 pair rows in canonical order', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  assert.equal(r.sourcesWithAllLenses, 1);
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'alpha');
  assert.equal(row.pairs.length, 15);
  for (const p of row.pairs) {
    assert.ok(p.iou >= 0 && p.iou <= 1);
    assert.ok(p.containmentRatio >= 0 && p.containmentRatio <= 1);
    assert.ok(p.overlap >= 0);
    assert.ok(p.union >= 0);
  }
});

test('build: per-row aggregates are consistent with pair vector', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  const row = r.sources[0]!;
  const ious = row.pairs.map((p) => p.iou);
  const sum = ious.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(row.meanIou - sum / 15) < 1e-12);
  assert.equal(row.minIou, Math.min(...ious));
  assert.equal(row.maxIou, Math.max(...ious));
  assert.ok(Math.abs(row.iouSpread - (row.maxIou - row.minIou)) < 1e-12);
  // weakPairs count consistency
  assert.equal(
    row.weakPairs,
    row.pairs.filter((p) => p.iou < r.weakIouThreshold).length,
  );
  assert.equal(
    row.strongPairs,
    row.pairs.filter((p) => p.iou >= r.strongIouThreshold).length,
  );
  assert.equal(row.disjointPairs, row.pairs.filter((p) => p.overlap === 0).length);
});

test('build: coherenceScore = meanIou * (1 - disjointPairs/15)', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  const row = r.sources[0]!;
  const expected = row.meanIou * (1 - row.disjointPairs / 15);
  assert.ok(Math.abs(row.coherenceScore - expected) < 1e-12);
});

test('build: coherenceScore is in [0, 1]', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
    ...ascending('gamma', 30, 5),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  for (const row of r.sources) {
    assert.ok(row.coherenceScore >= 0 && row.coherenceScore <= 1);
  }
});

test('build: meanIou in [0, 1] across a multi-source workload', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
    ...ascending('gamma', 30, 5),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  for (const row of r.sources) {
    assert.ok(row.meanIou >= 0 && row.meanIou <= 1);
  }
});

test('build: sources with too few rows are excluded by every lens (and so by us)', () => {
  // 3 rows isn't enough for any lens (min-rows default 4)
  const queue = [...ascending('thin', 3), ...ascending('thick', 30)];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  // 'thin' is dropped from EVERY lens, so it never enters totalSources
  // (the all-lenses intersection logic only sees 'thick')
  assert.equal(r.sourcesWithAllLenses, 1);
  assert.equal(r.sources[0]!.source, 'thick');
});

test('build: source filter restricts to one source', () => {
  const queue = [...ascending('alpha', 30), ...ascending('beta', 30)];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    source: 'beta',
  });
  assert.equal(r.sourcesWithAllLenses, 1);
  assert.equal(r.sources[0]!.source, 'beta');
});

test('build: unknown source filter -> zero rows', () => {
  const queue = [...ascending('alpha', 30)];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    source: 'nonexistent',
  });
  assert.equal(r.sourcesWithAllLenses, 0);
});

test('build: alertWeakMean filter drops sources whose meanIou >= threshold', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
    ...ascending('gamma', 30, 5),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    alertWeakMean: 1.0, // every source has meanIou < 1.0 -> all kept
  });
  assert.equal(r.sources.length, r.sourcesWithAllLenses);
  assert.equal(r.droppedAboveAlert, 0);
});

test('build: alertWeakMean = 0 drops every source (no source has meanIou < 0)', () => {
  const queue = [...ascending('alpha', 30), ...ascending('beta', 30)];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    alertWeakMean: 0,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAboveAlert, r.sourcesWithAllLenses);
});

test('build: top cap limits output rows', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
    ...ascending('gamma', 30, 5),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    top: 2,
  });
  assert.ok(r.sourcesWithAllLenses >= 2);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, r.sourcesWithAllLenses - 2);
});

test('build: top cap larger than rows -> no drop', () => {
  const queue = [...ascending('alpha', 30)];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    top: 100,
  });
  assert.equal(r.droppedBelowTopCap, 0);
});

// --- sort ordering ---

test('build: default sort is coherence-desc', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
    ...ascending('gamma', 30, 5),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  for (let i = 0; i + 1 < r.sources.length; i++) {
    assert.ok(
      r.sources[i]!.coherenceScore >= r.sources[i + 1]!.coherenceScore,
    );
  }
});

test('build: sort=coherence-asc reverses', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
    ...ascending('gamma', 30, 5),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    sort: 'coherence-asc',
  });
  for (let i = 0; i + 1 < r.sources.length; i++) {
    assert.ok(
      r.sources[i]!.coherenceScore <= r.sources[i + 1]!.coherenceScore,
    );
  }
});

test('build: sort=mean-iou-desc orders by meanIou descending', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
    ...ascending('gamma', 30, 5),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    sort: 'mean-iou-desc',
  });
  for (let i = 0; i + 1 < r.sources.length; i++) {
    assert.ok(r.sources[i]!.meanIou >= r.sources[i + 1]!.meanIou);
  }
});

test('build: sort=min-iou-desc orders by minIou descending', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    sort: 'min-iou-desc',
  });
  for (let i = 0; i + 1 < r.sources.length; i++) {
    assert.ok(r.sources[i]!.minIou >= r.sources[i + 1]!.minIou);
  }
});

test('build: sort=iou-spread-desc orders by spread descending', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    sort: 'iou-spread-desc',
  });
  for (let i = 0; i + 1 < r.sources.length; i++) {
    assert.ok(r.sources[i]!.iouSpread >= r.sources[i + 1]!.iouSpread);
  }
});

test('build: sort=weak-pairs-desc orders by weakPairs descending', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    sort: 'weak-pairs-desc',
  });
  for (let i = 0; i + 1 < r.sources.length; i++) {
    assert.ok(r.sources[i]!.weakPairs >= r.sources[i + 1]!.weakPairs);
  }
});

test('build: sort=disjoint-pairs-desc orders by disjointPairs descending', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    sort: 'disjoint-pairs-desc',
  });
  for (let i = 0; i + 1 < r.sources.length; i++) {
    assert.ok(r.sources[i]!.disjointPairs >= r.sources[i + 1]!.disjointPairs);
  }
});

test('build: sort=mean-containment-desc orders by meanContainment descending', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    sort: 'mean-containment-desc',
  });
  for (let i = 0; i + 1 < r.sources.length; i++) {
    assert.ok(
      r.sources[i]!.meanContainment >= r.sources[i + 1]!.meanContainment,
    );
  }
});

test('build: sort=source orders alphabetically', () => {
  const queue = [
    ...ascending('zeta', 30, 8),
    ...ascending('alpha', 30, 12),
    ...ascending('mu', 30, 5),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    sort: 'source',
  });
  for (let i = 0; i + 1 < r.sources.length; i++) {
    assert.ok(r.sources[i]!.source.localeCompare(r.sources[i + 1]!.source) <= 0);
  }
});

test('build: sort=rows orders by rowsKept descending', () => {
  const queue = [
    ...ascending('alpha', 50, 8),
    ...ascending('beta', 20, 12),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    sort: 'rows',
  });
  for (let i = 0; i + 1 < r.sources.length; i++) {
    assert.ok(r.sources[i]!.rowsKept >= r.sources[i + 1]!.rowsKept);
  }
});

// --- determinism ---

test('build: deterministic with fixed seed (two runs are exactly equal)', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
  ];
  const opts = {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    seed: 7,
  };
  const a = buildSourceRowTokenSlopeCiCoverageVolume(queue, opts);
  const b = buildSourceRowTokenSlopeCiCoverageVolume(queue, opts);
  assert.deepEqual(a, b);
});

test('build: different seeds may differ slightly', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
  ];
  const a = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    seed: 1,
  });
  const b = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    seed: 9999,
  });
  // They share structure but pair iou values are not exactly identical
  // (kept as a documentation-of-behaviour assertion: at least one differs OR they happen to coincide)
  assert.equal(a.sources.length, b.sources.length);
});

// --- aggregate report fields ---

test('build: meanCoherenceScore equals mean of per-source coherenceScores', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
    ...ascending('gamma', 30, 5),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  const expected =
    r.sources.reduce((acc, s) => acc + s.coherenceScore, 0) / r.sources.length;
  assert.ok(Math.abs(r.meanCoherenceScore - expected) < 1e-12);
});

test('build: weak/strong/anyDisjoint counts match per-source predicates', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
    ...ascending('gamma', 30, 5),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  assert.equal(
    r.weakMeanIouCount,
    r.sources.filter((s) => s.meanIou < r.weakIouThreshold).length,
  );
  assert.equal(
    r.strongMeanIouCount,
    r.sources.filter((s) => s.meanIou >= r.strongIouThreshold).length,
  );
  assert.equal(
    r.anyDisjointCount,
    r.sources.filter((s) => s.disjointPairs > 0).length,
  );
});

test('build: totalRowsKept equals sum of per-source rowsKept', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  const expected = r.sources.reduce((acc, s) => acc + s.rowsKept, 0);
  assert.equal(r.totalRowsKept, expected);
});

test('build: SLOPE_COVERAGE_LENS_NAMES is the canonical 6-tuple', () => {
  assert.deepEqual(SLOPE_COVERAGE_LENS_NAMES, [
    'bootstrap',
    'jackknife',
    'bca',
    'studentizedT',
    'abc',
    'profileLikelihood',
  ]);
});

test('build: weakIouThreshold / strongIouThreshold defaults are 0.5 and 0.9', () => {
  const r = buildSourceRowTokenSlopeCiCoverageVolume([], {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.weakIouThreshold, 0.5);
  assert.equal(r.strongIouThreshold, 0.9);
});

test('build: customizing weakIouThreshold flows through to the per-source counts', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
  ];
  const lo = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    weakIouThreshold: 0.1,
  });
  const hi = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    weakIouThreshold: 0.99,
    strongIouThreshold: 0.99,
  });
  // Higher threshold => more pairs counted as weak (or equal)
  for (let i = 0; i < lo.sources.length; i++) {
    assert.ok(lo.sources[i]!.weakPairs <= hi.sources[i]!.weakPairs);
  }
});

// --- renderer ---

test('renderer: empty report -> no-sources line', () => {
  const r = buildSourceRowTokenSlopeCiCoverageVolume([], {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiCoverageVolume(r);
  assert.match(out, /pew-insights source-row-token-slope-ci-coverage-volume/);
  assert.match(out, /\(no sources\)/);
});

test('renderer: includes header and column line for non-empty report', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  const out = renderSourceRowTokenSlopeCiCoverageVolume(r);
  assert.match(out, /source +rows +meanIou/);
  assert.match(out, /alpha/);
});

test('renderer: showPairs=true appends an iou line per source', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  const out = renderSourceRowTokenSlopeCiCoverageVolume(r, { showPairs: true });
  assert.match(out, /iou:/);
  assert.match(out, /bootstrap~jackknife=/);
  assert.match(out, /abc~profileLikelihood=/);
});

test('renderer: showPairs=false omits the per-source iou pair line', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  const out = renderSourceRowTokenSlopeCiCoverageVolume(r);
  // The per-source pair line uses the literal "bootstrap~jackknife=" token
  assert.equal(/bootstrap~jackknife=/.test(out), false);
});

test('renderer: surfaces meanCoherenceScore in the dropped/summary line', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  const out = renderSourceRowTokenSlopeCiCoverageVolume(r);
  assert.match(out, /meanCoherenceScore:/);
});

test('renderer: surfaces threshold and sort metadata in the header', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
    weakIouThreshold: 0.4,
    strongIouThreshold: 0.85,
    sort: 'mean-iou-desc',
  });
  const out = renderSourceRowTokenSlopeCiCoverageVolume(r);
  assert.match(out, /weak-iou: 0\.4/);
  assert.match(out, /strong-iou: 0\.85/);
  assert.match(out, /sort: mean-iou-desc/);
});

// --- refinement: minIouPair / maxIouPair + showExtremes ---

test('refinement: per-source minIouPair has iou == minIou and is a valid lens pair', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  for (const row of r.sources) {
    assert.equal(row.minIouPair.iou, row.minIou);
    assert.ok(SLOPE_COVERAGE_LENS_NAMES.includes(row.minIouPair.lensA));
    assert.ok(SLOPE_COVERAGE_LENS_NAMES.includes(row.minIouPair.lensB));
    // Canonical pair order: lensA index < lensB index
    const ai = SLOPE_COVERAGE_LENS_NAMES.indexOf(row.minIouPair.lensA);
    const bi = SLOPE_COVERAGE_LENS_NAMES.indexOf(row.minIouPair.lensB);
    assert.ok(ai < bi, `pair (${row.minIouPair.lensA}, ${row.minIouPair.lensB}) violates canonical order`);
  }
});

test('refinement: per-source maxIouPair has iou == maxIou and is a valid lens pair', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  for (const row of r.sources) {
    assert.equal(row.maxIouPair.iou, row.maxIou);
    assert.ok(SLOPE_COVERAGE_LENS_NAMES.includes(row.maxIouPair.lensA));
    assert.ok(SLOPE_COVERAGE_LENS_NAMES.includes(row.maxIouPair.lensB));
    const ai = SLOPE_COVERAGE_LENS_NAMES.indexOf(row.maxIouPair.lensA);
    const bi = SLOPE_COVERAGE_LENS_NAMES.indexOf(row.maxIouPair.lensB);
    assert.ok(ai < bi, `pair (${row.maxIouPair.lensA}, ${row.maxIouPair.lensB}) violates canonical order`);
  }
});

test('refinement: minIouPair and maxIouPair iou values bracket every per-pair iou', () => {
  const queue = [
    ...ascending('alpha', 30, 8),
    ...ascending('beta', 30, 12),
  ];
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  for (const row of r.sources) {
    for (const p of row.pairs) {
      assert.ok(p.iou >= row.minIouPair.iou - 1e-12);
      assert.ok(p.iou <= row.maxIouPair.iou + 1e-12);
    }
  }
});

test('refinement: tie-broken to the FIRST pair achieving min/max in canonical order', () => {
  // Two identical CIs (e.g. all six lenses produce the same interval)
  // have minIou == maxIou == 1 and the first canonical pair wins.
  // We can't easily fabricate that with the real lens kernels, but we
  // CAN check that when min == max the recorded pair is consistent.
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  const row = r.sources[0]!;
  if (row.minIou === row.maxIou) {
    assert.equal(row.minIouPair.lensA, row.maxIouPair.lensA);
    assert.equal(row.minIouPair.lensB, row.maxIouPair.lensB);
  }
  // The first pair scanned that achieves min is the one with the
  // smallest flat index over (i<j) lens order.
  let firstMinIdx = 0;
  for (let i = 1; i < row.pairs.length; i++) {
    if (row.pairs[i]!.iou < row.pairs[firstMinIdx]!.iou) firstMinIdx = i;
  }
  // Reconstruct that pair label
  let k = 0;
  let expectedA = SLOPE_COVERAGE_LENS_NAMES[0]!;
  let expectedB = SLOPE_COVERAGE_LENS_NAMES[1]!;
  outer: for (let i = 0; i < SLOPE_COVERAGE_LENS_NAMES.length; i++) {
    for (let j = i + 1; j < SLOPE_COVERAGE_LENS_NAMES.length; j++) {
      if (k === firstMinIdx) {
        expectedA = SLOPE_COVERAGE_LENS_NAMES[i]!;
        expectedB = SLOPE_COVERAGE_LENS_NAMES[j]!;
        break outer;
      }
      k += 1;
    }
  }
  assert.equal(row.minIouPair.lensA, expectedA);
  assert.equal(row.minIouPair.lensB, expectedB);
});

test('refinement: renderer with showExtremes appends an extremes line per source', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  const out = renderSourceRowTokenSlopeCiCoverageVolume(r, {
    showExtremes: true,
  });
  assert.match(out, /extremes: min /);
  assert.match(out, / max /);
});

test('refinement: renderer without showExtremes omits the extremes line', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  const out = renderSourceRowTokenSlopeCiCoverageVolume(r);
  assert.equal(/extremes: min /.test(out), false);
});

test('refinement: showExtremes and showPairs can be combined', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  const out = renderSourceRowTokenSlopeCiCoverageVolume(r, {
    showExtremes: true,
    showPairs: true,
  });
  assert.match(out, /extremes: min /);
  assert.match(out, /bootstrap~jackknife=/);
});

test('refinement: extremes line uses 4-decimal iou formatting', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCoverageVolume(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  const out = renderSourceRowTokenSlopeCiCoverageVolume(r, {
    showExtremes: true,
  });
  // every iou in the extremes line is reported with exactly 4 decimal places
  assert.match(out, /extremes: min \w+~\w+=\d\.\d{4} +max \w+~\w+=\d\.\d{4}/);
});
