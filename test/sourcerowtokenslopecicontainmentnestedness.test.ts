/**
 * Unit + integration tests for source-row-token-slope-ci-containment-nestedness.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiContainmentNestedness,
  renderSourceRowTokenSlopeCiContainmentNestedness,
  classifyPair,
  nestingChainDepthOf,
  SLOPE_CONTAINMENT_LENS_NAMES,
} from '../src/sourcerowtokenslopecicontainmentnestedness.js';
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

// --- classifyPair: trivial cases ---

test('classifyPair: identical intervals -> EQ', () => {
  assert.equal(classifyPair(0, 1, 0, 1), 'EQ');
});

test('classifyPair: A strictly inside B -> A_IN_B', () => {
  assert.equal(classifyPair(1, 2, 0, 3), 'A_IN_B');
});

test('classifyPair: B strictly inside A -> B_IN_A', () => {
  assert.equal(classifyPair(0, 3, 1, 2), 'B_IN_A');
});

test('classifyPair: completely disjoint -> DISJOINT', () => {
  assert.equal(classifyPair(0, 1, 2, 3), 'DISJOINT');
});

test('classifyPair: disjoint with B before A -> DISJOINT', () => {
  assert.equal(classifyPair(5, 10, 0, 4), 'DISJOINT');
});

test('classifyPair: partial overlap, A starts first -> PARTIAL', () => {
  assert.equal(classifyPair(0, 2, 1, 3), 'PARTIAL');
});

test('classifyPair: partial overlap, B starts first -> PARTIAL', () => {
  assert.equal(classifyPair(1, 3, 0, 2), 'PARTIAL');
});

// --- classifyPair: boundary cases (strict inequalities) ---

test('classifyPair: shared low bound, A inside on hi -> PARTIAL (not nested)', () => {
  // bLo == aLo so containment is not strict
  assert.equal(classifyPair(0, 1, 0, 2), 'PARTIAL');
});

test('classifyPair: shared hi bound, A inside on lo -> PARTIAL', () => {
  assert.equal(classifyPair(1, 2, 0, 2), 'PARTIAL');
});

test('classifyPair: shared low bound mirror -> PARTIAL', () => {
  assert.equal(classifyPair(0, 2, 0, 1), 'PARTIAL');
});

test('classifyPair: touching at single point -> PARTIAL (intersect = point)', () => {
  // hi_a == lo_b: not "hi_a < lo_b", so PARTIAL
  assert.equal(classifyPair(0, 1, 1, 2), 'PARTIAL');
});

test('classifyPair: touching at single point reversed -> PARTIAL', () => {
  assert.equal(classifyPair(1, 2, 0, 1), 'PARTIAL');
});

// --- classifyPair: degenerate intervals ---

test('classifyPair: degenerate point inside open interval -> A_IN_B if strict', () => {
  // A = [1,1], B = [0,2]. 0 < 1 AND 1 < 2 -> strict nest.
  assert.equal(classifyPair(1, 1, 0, 2), 'A_IN_B');
});

test('classifyPair: degenerate point on B boundary -> PARTIAL', () => {
  assert.equal(classifyPair(0, 0, 0, 2), 'PARTIAL');
});

test('classifyPair: two identical degenerate points -> EQ', () => {
  assert.equal(classifyPair(1, 1, 1, 1), 'EQ');
});

test('classifyPair: two distinct degenerate points -> DISJOINT', () => {
  assert.equal(classifyPair(1, 1, 2, 2), 'DISJOINT');
});

// --- classifyPair: validation ---

test('classifyPair: NaN endpoint throws', () => {
  assert.throws(() => classifyPair(Number.NaN, 1, 0, 1), /non-finite/);
});

test('classifyPair: Infinity endpoint throws', () => {
  assert.throws(() => classifyPair(0, Infinity, 0, 1), /non-finite/);
});

test('classifyPair: ill-formed A (lo > hi) throws', () => {
  assert.throws(() => classifyPair(2, 1, 0, 3), /A is ill-formed/);
});

test('classifyPair: ill-formed B (lo > hi) throws', () => {
  assert.throws(() => classifyPair(0, 1, 5, 4), /B is ill-formed/);
});

// --- classifyPair: negative ranges (slopes are signed) ---

test('classifyPair: negative range, nested -> A_IN_B', () => {
  assert.equal(classifyPair(-2, -1, -3, 0), 'A_IN_B');
});

test('classifyPair: negative range disjoint -> DISJOINT', () => {
  assert.equal(classifyPair(-5, -3, -2, 0), 'DISJOINT');
});

test('classifyPair: spans zero, nested -> B_IN_A', () => {
  assert.equal(classifyPair(-2, 2, -1, 1), 'B_IN_A');
});

test('classifyPair: spans zero, partial -> PARTIAL', () => {
  assert.equal(classifyPair(-2, 1, -1, 2), 'PARTIAL');
});

// --- classifyPair: float precision ---

test('classifyPair: float strict containment by epsilon -> A_IN_B', () => {
  const eps = 1e-12;
  assert.equal(classifyPair(0, 1, -eps, 1 + eps), 'A_IN_B');
});

test('classifyPair: float equality of two computed identical -> EQ', () => {
  const a = 0.1 + 0.2;
  assert.equal(classifyPair(a, a + 1, a, a + 1), 'EQ');
});

// --- nestingChainDepthOf ---

test('nestingChainDepthOf: empty -> 0', () => {
  assert.equal(nestingChainDepthOf([]), 0);
});

test('nestingChainDepthOf: singleton -> 1', () => {
  assert.equal(nestingChainDepthOf([{ lo: 0, hi: 1 }]), 1);
});

test('nestingChainDepthOf: two disjoint -> 1', () => {
  assert.equal(
    nestingChainDepthOf([
      { lo: 0, hi: 1 },
      { lo: 2, hi: 3 },
    ]),
    1,
  );
});

test('nestingChainDepthOf: two nested -> 2', () => {
  assert.equal(
    nestingChainDepthOf([
      { lo: 0, hi: 3 },
      { lo: 1, hi: 2 },
    ]),
    2,
  );
});

test('nestingChainDepthOf: total order of 6 -> 6', () => {
  const ivs = [
    { lo: 0, hi: 12 },
    { lo: 1, hi: 11 },
    { lo: 2, hi: 10 },
    { lo: 3, hi: 9 },
    { lo: 4, hi: 8 },
    { lo: 5, hi: 7 },
  ];
  assert.equal(nestingChainDepthOf(ivs), 6);
});

test('nestingChainDepthOf: total order regardless of input order', () => {
  const ivs = [
    { lo: 5, hi: 7 },
    { lo: 0, hi: 12 },
    { lo: 3, hi: 9 },
    { lo: 1, hi: 11 },
    { lo: 4, hi: 8 },
    { lo: 2, hi: 10 },
  ];
  assert.equal(nestingChainDepthOf(ivs), 6);
});

test('nestingChainDepthOf: chain plus disjoint extra -> chain length', () => {
  const ivs = [
    { lo: 0, hi: 10 },
    { lo: 1, hi: 9 },
    { lo: 2, hi: 8 },
    { lo: 100, hi: 200 }, // disjoint, length 1 alone
  ];
  assert.equal(nestingChainDepthOf(ivs), 3);
});

test('nestingChainDepthOf: equal intervals collapse into chain', () => {
  // Three equal and one bigger: chain is 4 (each equal is contained in the next).
  const ivs = [
    { lo: 1, hi: 2 },
    { lo: 1, hi: 2 },
    { lo: 1, hi: 2 },
    { lo: 0, hi: 3 },
  ];
  assert.equal(nestingChainDepthOf(ivs), 4);
});

test('nestingChainDepthOf: partial overlaps only -> 1', () => {
  const ivs = [
    { lo: 0, hi: 2 },
    { lo: 1, hi: 3 },
    { lo: 2, hi: 4 },
  ];
  assert.equal(nestingChainDepthOf(ivs), 1);
});

test('nestingChainDepthOf: shared low bound counts as inclusion', () => {
  const ivs = [
    { lo: 0, hi: 1 },
    { lo: 0, hi: 2 },
    { lo: 0, hi: 3 },
  ];
  assert.equal(nestingChainDepthOf(ivs), 3);
});

test('nestingChainDepthOf: bound is 6 even with redundant inclusions', () => {
  const ivs = [
    { lo: 0, hi: 100 },
    { lo: 0, hi: 99 },
    { lo: 0, hi: 50 },
    { lo: 0, hi: 25 },
    { lo: 0, hi: 12 },
    { lo: 0, hi: 6 },
  ];
  assert.equal(nestingChainDepthOf(ivs), 6);
});

// --- buildSourceRowTokenSlopeCiContainmentNestedness: validation ---

test('build: invalid minRows < 4 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiContainmentNestedness([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('build: non-integer minRows throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiContainmentNestedness([], {
        minRows: 4.5 as unknown as number,
      }),
    /minRows must be an integer/,
  );
});

test('build: confidence out of range (>=1) throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiContainmentNestedness([], { confidence: 1 }),
    /confidence must be a finite number in/,
  );
});

test('build: confidence <= 0 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiContainmentNestedness([], { confidence: 0 }),
    /confidence must be a finite number in/,
  );
});

test('build: NaN confidence throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiContainmentNestedness([], {
        confidence: Number.NaN,
      }),
    /confidence must be a finite number in/,
  );
});

test('build: lambda <= 0 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiContainmentNestedness([], { lambda: 0 }),
    /lambda must be a finite, strictly positive number/,
  );
});

test('build: lambda Infinity throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiContainmentNestedness([], { lambda: Infinity }),
    /lambda must be a finite, strictly positive number/,
  );
});

test('build: bootstraps < 100 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiContainmentNestedness([], { bootstraps: 50 }),
    /bootstraps must be an integer >= 100/,
  );
});

test('build: non-integer bootstraps throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiContainmentNestedness([], {
        bootstraps: 100.5 as unknown as number,
      }),
    /bootstraps must be an integer >= 100/,
  );
});

test('build: non-integer seed throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiContainmentNestedness([], {
        seed: 1.5 as unknown as number,
      }),
    /seed must be an integer/,
  );
});

test('build: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiContainmentNestedness([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('build: top non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiContainmentNestedness([], {
        top: 1.5 as unknown as number,
      }),
    /top must be a positive integer/,
  );
});

test('build: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiContainmentNestedness([], {
        sort: 'banana' as unknown as 'rows',
      }),
    /sort must be one of/,
  );
});

test('build: empty queue returns empty report with sane scalars', () => {
  const r = buildSourceRowTokenSlopeCiContainmentNestedness([], {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.droppedMissingLens, 0);
  assert.equal(r.anyDisjointCount, 0);
  assert.equal(r.cleanChainCount, 0);
  assert.equal(r.totalOrderCount, 0);
});

test('build: defaults are applied', () => {
  const r = buildSourceRowTokenSlopeCiContainmentNestedness([]);
  assert.equal(r.minRows, 4);
  assert.equal(r.confidence, 0.95);
  assert.equal(r.lambda, 1);
  assert.equal(r.bootstraps, 1000);
  assert.equal(r.seed, 42);
  assert.equal(r.alertDisjoint, false);
  assert.equal(r.alertCleanChain, false);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'nesting-fraction-desc');
});

// --- build: real behavior on synthetic data ---

test('build: ascending series produces all six lenses, MECE counts sum to 15', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.sourcesWithAllLenses, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 's1');
  assert.equal(
    row.eqPairs + row.nestedPairs + row.partialPairs + row.disjointPairs,
    15,
  );
  assert.equal(row.pairs.length, 15);
  assert.equal(row.contains.length, 6);
  assert.equal(row.containedBy.length, 6);
  assert.equal(row.equalTo.length, 6);
});

test('build: nestingFraction in [0, 1]', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  assert.ok(row.nestingFraction >= 0);
  assert.ok(row.nestingFraction <= 1);
  assert.ok(row.disjointFraction >= 0);
  assert.ok(row.disjointFraction <= 1);
});

test('build: nestingChainDepth in [1, 6]', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  assert.ok(row.nestingChainDepth >= 1);
  assert.ok(row.nestingChainDepth <= 6);
});

test('build: per-lens contains+containedBy+equalTo respects 5-peer cap', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  for (let i = 0; i < 6; i++) {
    const total = row.contains[i]! + row.containedBy[i]! + row.equalTo[i]!;
    assert.ok(total <= 5, `lens ${i} contains+containedBy+equalTo=${total} > 5`);
    assert.ok(row.contains[i]! >= 0);
    assert.ok(row.containedBy[i]! >= 0);
    assert.ok(row.equalTo[i]! >= 0);
  }
});

test('build: sum of contains across lenses equals nestedPairs', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  const sumContains = row.contains.reduce((a, b) => a + b, 0);
  const sumContainedBy = row.containedBy.reduce((a, b) => a + b, 0);
  assert.equal(sumContains, row.nestedPairs);
  assert.equal(sumContainedBy, row.nestedPairs);
});

test('build: sum of equalTo across lenses == 2 * eqPairs', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  const sumEq = row.equalTo.reduce((a, b) => a + b, 0);
  assert.equal(sumEq, 2 * row.eqPairs);
});

test('build: cleanChain implies no PARTIAL or DISJOINT pairs', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  if (row.cleanChain) {
    assert.equal(row.partialPairs, 0);
    assert.equal(row.disjointPairs, 0);
  }
});

test('build: anyDisjoint matches disjointPairs > 0', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  assert.equal(row.anyDisjoint, row.disjointPairs > 0);
});

test('build: nestingFraction == (eqPairs + nestedPairs) / 15', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  const expected = (row.eqPairs + row.nestedPairs) / 15;
  assert.ok(Math.abs(row.nestingFraction - expected) < 1e-12);
});

test('build: disjointFraction == disjointPairs / 15', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  const expected = row.disjointPairs / 15;
  assert.ok(Math.abs(row.disjointFraction - expected) < 1e-12);
});

test('build: widestContains in [0, 5]', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  assert.ok(row.widestContains >= 0);
  assert.ok(row.widestContains <= 5);
});

test('build: tightestContainedBy in [0, 5]', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  assert.ok(row.tightestContainedBy >= 0);
  assert.ok(row.tightestContainedBy <= 5);
});

test('build: widestLens is in canonical lens names', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  assert.ok(
    (SLOPE_CONTAINMENT_LENS_NAMES as readonly string[]).includes(
      row.widestLens,
    ),
  );
});

test('build: tightestLens is in canonical lens names', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  assert.ok(
    (SLOPE_CONTAINMENT_LENS_NAMES as readonly string[]).includes(
      row.tightestLens,
    ),
  );
});

test('build: meanWidth >= 0 and widthSpread >= 0', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  assert.ok(row.meanWidth >= 0);
  assert.ok(row.widthSpread >= 0);
});

test('build: pairs vector contains only valid relation strings', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const row = r.sources[0]!;
  const valid = new Set(['EQ', 'A_IN_B', 'B_IN_A', 'PARTIAL', 'DISJOINT']);
  for (const p of row.pairs) assert.ok(valid.has(p));
});

test('build: --since filter is forwarded to lens kernels', () => {
  const queue = [...ascending('s1', 30), ...ascending('s2', 30)];
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    since: '2030-01-01',
  });
  // All rows are before 2030 so everything is filtered out.
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.sources.length, 0);
});

test('build: --source filter restricts to one source', () => {
  const queue = [...ascending('s1', 30), ...ascending('s2', 30)];
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    source: 's1',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
});

test('build: --top caps results and accounts droppedBelowTopCap', () => {
  const queue = [
    ...ascending('a', 20),
    ...ascending('b', 20),
    ...ascending('c', 20),
  ];
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, { top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('build: --top larger than result count drops nothing', () => {
  const queue = ascending('s1', 20);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    top: 100,
  });
  assert.equal(r.droppedBelowTopCap, 0);
});

test('build: alertDisjoint filters out non-disjoint sources', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    alertDisjoint: true,
  });
  for (const row of r.sources) assert.equal(row.anyDisjoint, true);
});

test('build: alertCleanChain filters out non-total-order sources', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    alertCleanChain: true,
  });
  for (const row of r.sources) {
    assert.equal(row.cleanChain, true);
    assert.equal(row.nestingChainDepth, 6);
  }
});

test('build: alertDisjoint accounts droppedNotDisjoint', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    alertDisjoint: true,
  });
  // Either the source matches and droppedNotDisjoint=0, or it doesn't and =1.
  assert.equal(
    r.droppedNotDisjoint + r.sources.length,
    r.sourcesWithAllLenses,
  );
});

test('build: alertCleanChain accounts droppedNotCleanChain', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    alertCleanChain: true,
  });
  assert.equal(
    r.droppedNotCleanChain + r.sources.length,
    r.sourcesWithAllLenses,
  );
});

test('build: anyDisjointCount matches pre-filter count', () => {
  const queue = ascending('s1', 30);
  const r1 = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const expected = r1.sources.filter((x) => x.anyDisjoint).length;
  assert.equal(r1.anyDisjointCount, expected);
});

test('build: cleanChainCount matches pre-filter count', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  const expected = r.sources.filter((x) => x.cleanChain).length;
  assert.equal(r.cleanChainCount, expected);
});

test('build: totalOrderCount <= cleanChainCount', () => {
  const queue = [...ascending('s1', 30), ...ascending('s2', 30)];
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue);
  assert.ok(r.totalOrderCount <= r.cleanChainCount);
});

test('build: sort=source orders alphabetically', () => {
  const queue = [
    ...ascending('zeta', 20),
    ...ascending('alpha', 20),
    ...ascending('beta', 20),
  ];
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    sort: 'source',
  });
  const names = r.sources.map((x) => x.source);
  assert.deepEqual(names, [...names].sort());
});

test('build: sort=rows orders by rowsKept desc', () => {
  const queue = [...ascending('a', 10), ...ascending('b', 30)];
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    sort: 'rows',
  });
  for (let i = 1; i < r.sources.length; i++) {
    assert.ok(r.sources[i - 1]!.rowsKept >= r.sources[i]!.rowsKept);
  }
});

test('build: sort=nesting-fraction-desc orders descending', () => {
  const queue = [...ascending('a', 20), ...ascending('b', 30)];
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    sort: 'nesting-fraction-desc',
  });
  for (let i = 1; i < r.sources.length; i++) {
    assert.ok(
      r.sources[i - 1]!.nestingFraction >= r.sources[i]!.nestingFraction,
    );
  }
});

test('build: sort=nesting-fraction-asc orders ascending', () => {
  const queue = [...ascending('a', 20), ...ascending('b', 30)];
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    sort: 'nesting-fraction-asc',
  });
  for (let i = 1; i < r.sources.length; i++) {
    assert.ok(
      r.sources[i - 1]!.nestingFraction <= r.sources[i]!.nestingFraction,
    );
  }
});

test('build: sort=disjoint-fraction-desc orders descending', () => {
  const queue = [...ascending('a', 20), ...ascending('b', 30)];
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    sort: 'disjoint-fraction-desc',
  });
  for (let i = 1; i < r.sources.length; i++) {
    assert.ok(
      r.sources[i - 1]!.disjointFraction >= r.sources[i]!.disjointFraction,
    );
  }
});

test('build: sort=chain-depth-desc orders descending', () => {
  const queue = [...ascending('a', 20), ...ascending('b', 30)];
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    sort: 'chain-depth-desc',
  });
  for (let i = 1; i < r.sources.length; i++) {
    assert.ok(
      r.sources[i - 1]!.nestingChainDepth >= r.sources[i]!.nestingChainDepth,
    );
  }
});

test('build: ties broken by source name asc', () => {
  const queue = [...ascending('zz', 20), ...ascending('aa', 20)];
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    sort: 'nesting-fraction-desc',
  });
  // Same construction => same nestingFraction => tie => alpha order.
  if (
    r.sources.length === 2 &&
    r.sources[0]!.nestingFraction === r.sources[1]!.nestingFraction
  ) {
    assert.equal(r.sources[0]!.source, 'aa');
    assert.equal(r.sources[1]!.source, 'zz');
  }
});

test('build: source missing from one lens is dropped', () => {
  // Need fewer rows than minRows to make some lenses fail. Use minRows=10
  // and feed only 5 rows for one source, plenty for another.
  const queue = [...ascending('full', 20), ...ascending('thin', 5)];
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    minRows: 10,
  });
  // 'thin' should be missing from all lenses (rowsKept < minRows everywhere)
  // so neither shared nor counted as missing — it never enters.
  // 'full' should be present.
  const sources = r.sources.map((x) => x.source);
  assert.ok(sources.includes('full'));
  assert.ok(!sources.includes('thin'));
});

test('build: SLOPE_CONTAINMENT_LENS_NAMES has 6 entries', () => {
  assert.equal(SLOPE_CONTAINMENT_LENS_NAMES.length, 6);
});

test('build: SLOPE_CONTAINMENT_LENS_NAMES are unique', () => {
  const set = new Set(SLOPE_CONTAINMENT_LENS_NAMES);
  assert.equal(set.size, SLOPE_CONTAINMENT_LENS_NAMES.length);
});

test('build: generatedAt override is honored', () => {
  const r = buildSourceRowTokenSlopeCiContainmentNestedness([], {
    generatedAt: '2099-01-01T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2099-01-01T00:00:00.000Z');
});

test('build: report mirrors filter scalars', () => {
  const r = buildSourceRowTokenSlopeCiContainmentNestedness([], {
    since: '2026-01-01',
    until: '2026-12-31',
    source: 'sx',
    minRows: 8,
    confidence: 0.9,
    lambda: 2,
    bootstraps: 200,
    seed: 7,
    alertDisjoint: true,
    alertCleanChain: true,
    top: 5,
    sort: 'chain-depth-asc',
  });
  assert.equal(r.windowStart, '2026-01-01');
  assert.equal(r.windowEnd, '2026-12-31');
  assert.equal(r.source, 'sx');
  assert.equal(r.minRows, 8);
  assert.equal(r.confidence, 0.9);
  assert.equal(r.lambda, 2);
  assert.equal(r.bootstraps, 200);
  assert.equal(r.seed, 7);
  assert.equal(r.alertDisjoint, true);
  assert.equal(r.alertCleanChain, true);
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'chain-depth-asc');
});

test('build: deterministic across repeated runs (same seed)', () => {
  const queue = ascending('s1', 30);
  const r1 = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    generatedAt: 'x',
  });
  const r2 = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    generatedAt: 'x',
  });
  assert.deepEqual(r1.sources, r2.sources);
});

// --- renderer ---

test('render: includes header line', () => {
  const r = buildSourceRowTokenSlopeCiContainmentNestedness([], {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiContainmentNestedness(r);
  assert.match(out, /pew-insights source-row-token-slope-ci-containment-nestedness/);
});

test('render: includes "as of" line with scalars', () => {
  const r = buildSourceRowTokenSlopeCiContainmentNestedness([], {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiContainmentNestedness(r);
  assert.match(out, /as of: 2026-04-30T00:00:00\.000Z/);
  assert.match(out, /min-rows: 4/);
  assert.match(out, /confidence: 0\.95/);
});

test('render: includes dropped accounting line', () => {
  const r = buildSourceRowTokenSlopeCiContainmentNestedness([], {
    generatedAt: 'x',
  });
  const out = renderSourceRowTokenSlopeCiContainmentNestedness(r);
  assert.match(out, /any-disjoint:/);
  assert.match(out, /clean-chain:/);
  assert.match(out, /total-order \(chain==6\):/);
});

test('render: empty source list renders "(no sources)"', () => {
  const r = buildSourceRowTokenSlopeCiContainmentNestedness([], {
    generatedAt: 'x',
  });
  const out = renderSourceRowTokenSlopeCiContainmentNestedness(r);
  assert.match(out, /\(no sources\)/);
});

test('render: non-empty produces a table header', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    generatedAt: 'x',
  });
  const out = renderSourceRowTokenSlopeCiContainmentNestedness(r);
  assert.match(out, /source\s+rows\s+EQ\/N\/P\/D/);
});

test('render: source row appears in output', () => {
  const queue = ascending('mysrc', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    generatedAt: 'x',
  });
  const out = renderSourceRowTokenSlopeCiContainmentNestedness(r);
  assert.match(out, /mysrc/);
});

test('render: alert-disjoint flag yes/no shown', () => {
  const r1 = buildSourceRowTokenSlopeCiContainmentNestedness([], {
    alertDisjoint: true,
    generatedAt: 'x',
  });
  const out1 = renderSourceRowTokenSlopeCiContainmentNestedness(r1);
  assert.match(out1, /alert-disjoint: yes/);
  const r2 = buildSourceRowTokenSlopeCiContainmentNestedness([], {
    generatedAt: 'x',
  });
  const out2 = renderSourceRowTokenSlopeCiContainmentNestedness(r2);
  assert.match(out2, /alert-disjoint: no/);
});

test('render: alert-clean-chain flag yes/no shown', () => {
  const r1 = buildSourceRowTokenSlopeCiContainmentNestedness([], {
    alertCleanChain: true,
    generatedAt: 'x',
  });
  const out1 = renderSourceRowTokenSlopeCiContainmentNestedness(r1);
  assert.match(out1, /alert-clean-chain: yes/);
});

test('render: top "-" shown when null', () => {
  const r = buildSourceRowTokenSlopeCiContainmentNestedness([], {
    generatedAt: 'x',
  });
  const out = renderSourceRowTokenSlopeCiContainmentNestedness(r);
  assert.match(out, /top: -/);
});

test('render: top number shown when set', () => {
  const r = buildSourceRowTokenSlopeCiContainmentNestedness([], {
    top: 5,
    generatedAt: 'x',
  });
  const out = renderSourceRowTokenSlopeCiContainmentNestedness(r);
  assert.match(out, /top: 5/);
});

test('render: sort key shown', () => {
  const r = buildSourceRowTokenSlopeCiContainmentNestedness([], {
    sort: 'chain-depth-desc',
    generatedAt: 'x',
  });
  const out = renderSourceRowTokenSlopeCiContainmentNestedness(r);
  assert.match(out, /sort: chain-depth-desc/);
});

test('render: yes/NO for cleanChain column', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiContainmentNestedness(queue, {
    generatedAt: 'x',
  });
  const out = renderSourceRowTokenSlopeCiContainmentNestedness(r);
  // At least one of yes or NO must appear in the data row.
  assert.ok(/\b(yes|NO)\b/.test(out));
});
