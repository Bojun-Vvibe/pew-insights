import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenGenEntropyNegOneIndex,
  genEntropyNegOneOfVector,
} from '../src/dailytokengenentropynegoneindex.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-01T00:00:00.000Z';

// ---- genEntropyNegOneOfVector primitive ----------------------------

test('genEntropyNegOneOfVector: empty -> degenerate, GE=0', () => {
  const r = genEntropyNegOneOfVector([]);
  assert.equal(r.genEntropy, 0);
  assert.equal(r.degenerate, true);
});

test('genEntropyNegOneOfVector: n=1 -> degenerate, GE=0', () => {
  const r = genEntropyNegOneOfVector([42]);
  assert.equal(r.genEntropy, 0);
  assert.equal(r.degenerate, true);
});

test('genEntropyNegOneOfVector: all-zero -> degenerate, GE=0', () => {
  const r = genEntropyNegOneOfVector([0, 0, 0, 0]);
  assert.equal(r.genEntropy, 0);
  assert.equal(r.degenerate, true);
});

test('genEntropyNegOneOfVector: perfect equality -> GE=0', () => {
  const r = genEntropyNegOneOfVector([10, 10, 10, 10, 10]);
  assert.ok(Math.abs(r.genEntropy) < 1e-12, `expected GE=0, got ${r.genEntropy}`);
  assert.equal(r.degenerate, false);
});

test('genEntropyNegOneOfVector: scale-invariant', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = genEntropyNegOneOfVector(v).genEntropy;
  const b = genEntropyNegOneOfVector(v.map((x) => x * 1000)).genEntropy;
  assert.ok(Math.abs(a - b) < 1e-9, `scale-invariance broken: ${a} vs ${b}`);
});

test('genEntropyNegOneOfVector: permutation-invariant', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = genEntropyNegOneOfVector(v).genEntropy;
  const b = genEntropyNegOneOfVector([11, 4, 9, 3, 7, 1]).genEntropy;
  assert.ok(Math.abs(a - b) < 1e-15);
});

test('genEntropyNegOneOfVector: known closed-form on [1,4]', () => {
  // mu = 2.5; (mu/x)^2 = (2.5)^2 = 6.25 and (2.5/4)^2 = 0.390625
  // mean = (6.25 + 0.390625) / 2 = 3.3203125
  // GE(-1) = 0.5 * (3.3203125 - 1) = 1.16015625
  const r = genEntropyNegOneOfVector([1, 4]);
  assert.ok(
    Math.abs(r.genEntropy - 1.16015625) < 1e-12,
    `closed-form mismatch: ${r.genEntropy}`,
  );
});

test('genEntropyNegOneOfVector: bottom-tail spread strictly increases GE(-1)', () => {
  // Pigou-Dalton in reverse: take from poor, give to rich -> GE(-1) up
  const base = [10, 10, 10, 10];
  const spread = [1, 13, 13, 13]; // same total 40
  const a = genEntropyNegOneOfVector(base).genEntropy;
  const b = genEntropyNegOneOfVector(spread).genEntropy;
  assert.ok(b > a, `expected GE(-1) to rise on bottom-spread: ${a} -> ${b}`);
});

test('genEntropyNegOneOfVector: monotone in shrinking the smallest entry', () => {
  // Holding others fixed, reducing the smallest entry must (weakly)
  // increase GE(-1) -- that is the bottom-tail signature.
  let prev = -Infinity;
  for (const x of [10, 5, 2, 1, 0.1, 0.01]) {
    const ge = genEntropyNegOneOfVector([x, 100, 100, 100]).genEntropy;
    assert.ok(ge >= prev, `non-monotone: ${prev} -> ${ge} at x=${x}`);
    prev = ge;
  }
});

test('genEntropyNegOneOfVector: throws on zero entry inside positive vector', () => {
  assert.throws(() => genEntropyNegOneOfVector([1, 2, 0, 4]), /strictly positive/);
});

test('genEntropyNegOneOfVector: throws on negative entry', () => {
  assert.throws(() => genEntropyNegOneOfVector([1, 2, -1, 4]), /non-negative/);
});

test('genEntropyNegOneOfVector: throws on non-finite entry', () => {
  assert.throws(() => genEntropyNegOneOfVector([1, 2, Number.NaN, 4]), /non-negative/);
});

// ---- builder integration -------------------------------------------

test('builder: empty queue -> empty report', () => {
  const r = buildDailyTokenGenEntropyNegOneIndex([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('builder: single source perfect equality -> GE=0', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 100),
    ql('2026-04-26T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenGenEntropyNegOneIndex(queue, { generatedAt: GEN, minTokens: 0 });
  assert.equal(r.sources.length, 1);
  assert.ok(Math.abs(r.sources[0]!.genEntropy) < 1e-12);
  assert.equal(r.sources[0]!.degenerate, false);
});

test('builder: minDays filter drops sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 100000),
    ql('2026-04-26T00:00:00.000Z', 'a', 100000),
  ];
  const r = buildDailyTokenGenEntropyNegOneIndex(queue, {
    generatedAt: GEN,
    minDays: 3,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDays, 1);
});

test('builder: include-ge2-anchor surfaces ge2 + gap', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 1000),
    ql('2026-04-26T00:00:00.000Z', 'a', 4000),
    ql('2026-04-27T00:00:00.000Z', 'a', 9000),
  ];
  const r = buildDailyTokenGenEntropyNegOneIndex(queue, {
    generatedAt: GEN,
    includeGe2Anchor: true,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.ok(s.ge2 !== undefined);
  assert.ok(s.ge2Gap !== undefined);
  assert.ok(Number.isFinite(s.genEntropyOverGe2!));
  // gap consistency
  assert.ok(Math.abs((s.genEntropy - s.ge2!) - s.ge2Gap!) < 1e-12);
});

test('builder: ge2Gap > 0 on a strict bottom-tail-skewed source', () => {
  // One very small day among large ones: GE(-1) blows up, GE(2) modest.
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 10),
    ql('2026-04-26T00:00:00.000Z', 'a', 100000),
    ql('2026-04-27T00:00:00.000Z', 'a', 100000),
    ql('2026-04-28T00:00:00.000Z', 'a', 100000),
  ];
  const r = buildDailyTokenGenEntropyNegOneIndex(queue, {
    generatedAt: GEN,
    includeGe2Anchor: true,
  });
  const s = r.sources[0]!;
  assert.ok(s.genEntropy > s.ge2!, `expected GE(-1) > GE(2) on bottom-skew: ${s.genEntropy} vs ${s.ge2}`);
  assert.ok(s.ge2Gap! > 0);
});

test('builder: rebalancing toward equality strictly reduces GE(-1)', () => {
  // Move 100 tokens from the largest day to the smallest day, holding
  // the total fixed. GE(-1) must strictly decrease (Pigou-Dalton at
  // matched total is the textbook strict-Lorenz-domination test).
  const sparseQ: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 200),
    ql('2026-04-26T00:00:00.000Z', 'a', 1000),
    ql('2026-04-27T00:00:00.000Z', 'a', 1000),
    ql('2026-04-28T00:00:00.000Z', 'a', 1800),
  ];
  const balancedQ: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 300),
    ql('2026-04-26T00:00:00.000Z', 'a', 1000),
    ql('2026-04-27T00:00:00.000Z', 'a', 1000),
    ql('2026-04-28T00:00:00.000Z', 'a', 1700),
  ];
  const a = buildDailyTokenGenEntropyNegOneIndex(sparseQ, {
    generatedAt: GEN,
    minTokens: 0,
  }).sources[0]!.genEntropy;
  const b = buildDailyTokenGenEntropyNegOneIndex(balancedQ, {
    generatedAt: GEN,
    minTokens: 0,
  }).sources[0]!.genEntropy;
  assert.ok(b < a, `Pigou-Dalton equalising transfer must reduce GE(-1): ${a} -> ${b}`);
});

test('builder: window filter is honoured', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 1000),
    ql('2026-04-26T00:00:00.000Z', 'a', 2000),
    ql('2026-04-27T00:00:00.000Z', 'a', 3000),
    ql('2026-04-28T00:00:00.000Z', 'a', 4000),
  ];
  const r = buildDailyTokenGenEntropyNegOneIndex(queue, {
    generatedAt: GEN,
    since: '2026-04-26T00:00:00.000Z',
    until: '2026-04-29T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.nDays, 3);
});

test('builder: scale-invariance at the report level', () => {
  const mk = (mult: number): QueueLine[] => [
    ql('2026-04-25T00:00:00.000Z', 'a', 1000 * mult),
    ql('2026-04-26T00:00:00.000Z', 'a', 4000 * mult),
    ql('2026-04-27T00:00:00.000Z', 'a', 9000 * mult),
    ql('2026-04-28T00:00:00.000Z', 'a', 16000 * mult),
  ];
  const a = buildDailyTokenGenEntropyNegOneIndex(mk(1), { generatedAt: GEN }).sources[0]!.genEntropy;
  const b = buildDailyTokenGenEntropyNegOneIndex(mk(1000), { generatedAt: GEN }).sources[0]!.genEntropy;
  assert.ok(Math.abs(a - b) < 1e-9, `scale-invariance: ${a} vs ${b}`);
});

test('builder: rejects invalid sort', () => {
  assert.throws(
    () =>
      buildDailyTokenGenEntropyNegOneIndex([], {
        generatedAt: GEN,
        // @ts-expect-error - intentional bad input
        sort: 'bogus',
      }),
    /sort must be one of/,
  );
});

test('builder: rejects minDays < 2', () => {
  assert.throws(
    () =>
      buildDailyTokenGenEntropyNegOneIndex([], {
        generatedAt: GEN,
        minDays: 1,
      }),
    /minDays/,
  );
});

// ---- property-based / randomized invariants -------------------------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('property: GE(-1) is non-negative on random positive vectors', () => {
  const r = rng(42);
  for (let trial = 0; trial < 50; trial++) {
    const n = 3 + Math.floor(r() * 20);
    const v: number[] = [];
    for (let i = 0; i < n; i++) v.push(1 + r() * 1000);
    const ge = genEntropyNegOneOfVector(v).genEntropy;
    assert.ok(ge >= -1e-12, `negative GE(-1)=${ge} on ${JSON.stringify(v)}`);
  }
});

test('property: GE(-1) increasing under rank-preserving Pigou-Dalton spread (poor->rich)', () => {
  const r = rng(7);
  for (let trial = 0; trial < 30; trial++) {
    const n = 4 + Math.floor(r() * 8);
    const base: number[] = [];
    for (let i = 0; i < n; i++) base.push(50 + r() * 50);
    base.sort((a, b) => a - b);
    // transfer 5 units from index 0 (poor) to index n-1 (rich)
    if (base[0]! < 6) continue; // ensure positivity
    const spread = base.slice();
    spread[0] = spread[0]! - 5;
    spread[n - 1] = spread[n - 1]! + 5;
    const a = genEntropyNegOneOfVector(base).genEntropy;
    const b = genEntropyNegOneOfVector(spread).genEntropy;
    assert.ok(b >= a - 1e-12, `Pigou-Dalton violation: ${a} -> ${b}`);
  }
});

test('property: GE(-1) and GE(2) are NOT proportional (orthogonality witness)', () => {
  // Find a pair of distributions where ordering by GE(-1) flips ordering by GE(2).
  const A = [1, 100, 100, 100]; // bottom-tail-skewed
  const B = [50, 50, 50, 200]; // top-tail-skewed
  const queueA: QueueLine[] = A.map((v, i) =>
    ql(`2026-04-${20 + i}T00:00:00.000Z`, 'A', v),
  );
  const queueB: QueueLine[] = B.map((v, i) =>
    ql(`2026-04-${20 + i}T00:00:00.000Z`, 'B', v),
  );
  const ra = buildDailyTokenGenEntropyNegOneIndex(queueA, {
    generatedAt: GEN,
    includeGe2Anchor: true,
    minTokens: 0,
  }).sources[0]!;
  const rb = buildDailyTokenGenEntropyNegOneIndex(queueB, {
    generatedAt: GEN,
    includeGe2Anchor: true,
    minTokens: 0,
  }).sources[0]!;
  // A has higher GE(-1), B has higher GE(2): demonstrates non-monotone relation.
  assert.ok(ra.genEntropy > rb.genEntropy, `A.GE(-1)=${ra.genEntropy} <= B.GE(-1)=${rb.genEntropy}`);
  assert.ok(rb.ge2! > ra.ge2!, `B.GE(2)=${rb.ge2} <= A.GE(2)=${ra.ge2}`);
});
