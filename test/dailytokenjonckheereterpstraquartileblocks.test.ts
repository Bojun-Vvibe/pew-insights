import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenJonckheereTerpstraQuartileBlocks,
  buildDailyTokenJonckheereTerpstraQuartileBlocks,
  partitionIntoConsecutiveBlocks,
  pairwiseMannWhitneyUCountJonckheere,
  standardNormalUpperTailJonckheereTerpstra,
  aggregateJonckheereTerpstraQuartileBlocks,
} from '../src/dailytokenjonckheereterpstraquartileblocks.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return { hour_start, source, total_tokens } as unknown as QueueLine;
}

function dayIso(i: number): string {
  return (
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z'
  );
}

// ---------- partitionIntoConsecutiveBlocks ----------

test('partitionIntoConsecutiveBlocks: n=20, k=4 => [5,5,5,5]', () => {
  assert.deepEqual(partitionIntoConsecutiveBlocks(20, 4), [5, 5, 5, 5]);
});

test('partitionIntoConsecutiveBlocks: n=22, k=4 => [6,6,5,5]', () => {
  assert.deepEqual(partitionIntoConsecutiveBlocks(22, 4), [6, 6, 5, 5]);
});

test('partitionIntoConsecutiveBlocks: sum equals n always', () => {
  for (let n = 4; n < 100; n += 1) {
    const sizes = partitionIntoConsecutiveBlocks(n, 4);
    assert.equal(sizes.reduce((a, b) => a + b, 0), n);
  }
});

test('partitionIntoConsecutiveBlocks: n=0 => all zeros', () => {
  assert.deepEqual(partitionIntoConsecutiveBlocks(0, 4), [0, 0, 0, 0]);
});

test('partitionIntoConsecutiveBlocks: rejects k<=0 / non-int', () => {
  assert.throws(() => partitionIntoConsecutiveBlocks(20, 0));
  assert.throws(() => partitionIntoConsecutiveBlocks(20, -1));
  assert.throws(() => partitionIntoConsecutiveBlocks(20.5, 4));
});

// ---------- pairwiseMannWhitneyUCountJonckheere ----------

test('pairwiseMannWhitneyUCountJonckheere: all G_j > all G_i => U = |G_i| * |G_j|', () => {
  const u = pairwiseMannWhitneyUCountJonckheere([1, 2, 3], [10, 20, 30]);
  assert.equal(u, 9);
});

test('pairwiseMannWhitneyUCountJonckheere: all G_j < all G_i => U = 0', () => {
  const u = pairwiseMannWhitneyUCountJonckheere([10, 20, 30], [1, 2, 3]);
  assert.equal(u, 0);
});

test('pairwiseMannWhitneyUCountJonckheere: all equal => U = 0.5 * |G_i| * |G_j|', () => {
  const u = pairwiseMannWhitneyUCountJonckheere([5, 5, 5], [5, 5]);
  assert.equal(u, 3); // 6 pairs * 0.5
});

test('pairwiseMannWhitneyUCountJonckheere: mixed', () => {
  // a=[1,4], b=[2,3,5]: (1,2)<,(1,3)<,(1,5)<,(4,2)>,(4,3)>,(4,5)<
  // U = 4 (less-than) + 0 (ties) = 4
  const u = pairwiseMannWhitneyUCountJonckheere([1, 4], [2, 3, 5]);
  assert.equal(u, 4);
});

// ---------- standardNormalUpperTailJonckheereTerpstra ----------

test('standardNormalUpperTailJonckheereTerpstra: Q(0) ~ 0.5', () => {
  assert.ok(
    Math.abs(standardNormalUpperTailJonckheereTerpstra(0) - 0.5) < 1e-7,
  );
});

test('standardNormalUpperTailJonckheereTerpstra: Q(1.96) ~ 0.025', () => {
  assert.ok(
    Math.abs(standardNormalUpperTailJonckheereTerpstra(1.96) - 0.025) < 1e-4,
  );
});

test('standardNormalUpperTailJonckheereTerpstra: Q(-z) = 1 - Q(z)', () => {
  for (const z of [0.1, 0.5, 1.0, 2.5, 3.5]) {
    const q1 = standardNormalUpperTailJonckheereTerpstra(z);
    const q2 = standardNormalUpperTailJonckheereTerpstra(-z);
    assert.ok(Math.abs(q2 - (1 - q1)) < 1e-7);
  }
});

test('standardNormalUpperTailJonckheereTerpstra: throws on non-finite', () => {
  assert.throws(() =>
    standardNormalUpperTailJonckheereTerpstra(Number.NaN),
  );
});

// ---------- dailyTokenJonckheereTerpstraQuartileBlocks ----------

test('dailyTokenJonckheereTerpstraQuartileBlocks: requires n >= 20', () => {
  assert.throws(() =>
    dailyTokenJonckheereTerpstraQuartileBlocks([1, 2, 3, 4, 5]),
  );
});

test('dailyTokenJonckheereTerpstraQuartileBlocks: rejects non-finite', () => {
  const v = new Array(20).fill(1).map((_, i) => i);
  v[5] = Number.NaN;
  assert.throws(() => dailyTokenJonckheereTerpstraQuartileBlocks(v));
});

test('dailyTokenJonckheereTerpstraQuartileBlocks: zero variance throws', () => {
  const v = new Array(20).fill(7);
  assert.throws(() => dailyTokenJonckheereTerpstraQuartileBlocks(v));
});

test('dailyTokenJonckheereTerpstraQuartileBlocks: strictly increasing => jtJ = jtJMax (perfect ordering)', () => {
  const v = new Array(20).fill(0).map((_, i) => i + 1);
  const r = dailyTokenJonckheereTerpstraQuartileBlocks(v);
  // n=20, sizes=[5,5,5,5], jtJMax = sum_{i<j} 5*5 = 6*25 = 150
  assert.equal(r.jtJ, 150);
  // E[jtJ] = (400 - 100)/4 = 75
  assert.equal(r.jtExpected, 75);
  assert.ok(r.jtZ > 4); // very strong positive
  assert.ok(r.jtPValue < 1e-4);
});

test('dailyTokenJonckheereTerpstraQuartileBlocks: strictly decreasing => jtJ = 0', () => {
  const v = new Array(20).fill(0).map((_, i) => 20 - i);
  const r = dailyTokenJonckheereTerpstraQuartileBlocks(v);
  assert.equal(r.jtJ, 0);
  assert.ok(r.jtZ < -4);
  assert.ok(r.jtPValue < 1e-4);
});

test('dailyTokenJonckheereTerpstraQuartileBlocks: shift-invariance jtJ(x+c) = jtJ(x)', () => {
  const v = new Array(20).fill(0).map((_, i) => Math.sin(i) + i * 0.1);
  const r1 = dailyTokenJonckheereTerpstraQuartileBlocks(v);
  const r2 = dailyTokenJonckheereTerpstraQuartileBlocks(v.map((x) => x + 1000));
  assert.equal(r1.jtJ, r2.jtJ);
  assert.ok(Math.abs(r1.jtZ - r2.jtZ) < 1e-12);
});

test('dailyTokenJonckheereTerpstraQuartileBlocks: positive-scale invariance jtJ(a*x) = jtJ(x)', () => {
  const v = new Array(20).fill(0).map((_, i) => Math.sin(i) + i * 0.1 + 5);
  const r1 = dailyTokenJonckheereTerpstraQuartileBlocks(v);
  const r2 = dailyTokenJonckheereTerpstraQuartileBlocks(v.map((x) => x * 13.7));
  assert.equal(r1.jtJ, r2.jtJ);
});

test('dailyTokenJonckheereTerpstraQuartileBlocks: negation flips sign jtJ(-x) + jtJ(x) = jtJMax', () => {
  const v = new Array(20).fill(0).map((_, i) => Math.sin(i * 0.7) + i * 0.05);
  const r1 = dailyTokenJonckheereTerpstraQuartileBlocks(v);
  const r2 = dailyTokenJonckheereTerpstraQuartileBlocks(v.map((x) => -x));
  // jtJMax = 150 for n=20, k=4, sizes=[5,5,5,5]
  assert.equal(r1.jtJ + r2.jtJ, 150);
  assert.ok(Math.abs(r1.jtZ + r2.jtZ) < 1e-10);
});

test('dailyTokenJonckheereTerpstraQuartileBlocks: blockSizes sums to n', () => {
  for (const n of [20, 21, 22, 23, 24, 30, 47, 100]) {
    const v = new Array(n).fill(0).map((_, i) => Math.sin(i) + i * 0.01);
    const r = dailyTokenJonckheereTerpstraQuartileBlocks(v);
    assert.equal(r.jtBlockSizes.reduce((a, b) => a + b, 0), n);
    assert.equal(r.jtK, 4);
  }
});

test('dailyTokenJonckheereTerpstraQuartileBlocks: U-shape returns near-zero jtZ (cancellation)', () => {
  // Q1 high, Q2 low, Q3 low, Q4 high
  const v = [
    100, 100, 100, 100, 100,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    100, 100, 100, 100, 100,
  ];
  const r = dailyTokenJonckheereTerpstraQuartileBlocks(v);
  // jtJ contributions:
  //  Q1 vs Q2: 0  (Q1 all > Q2)
  //  Q1 vs Q3: 0
  //  Q1 vs Q4: 5*5 * 0.5 = 12.5 (all ties)
  //  Q2 vs Q3: 5*5 * 0.5 = 12.5 (all ties)
  //  Q2 vs Q4: 25 (all Q2 < Q4)
  //  Q3 vs Q4: 25 (all Q3 < Q4)
  //  Total = 75; matches expectation 75; jtZ ~ 0
  assert.equal(r.jtJ, 75);
  assert.ok(Math.abs(r.jtZ) < 1e-10);
});

// ---------- buildDailyTokenJonckheereTerpstraQuartileBlocks ----------

test('buildDailyTokenJonckheereTerpstraQuartileBlocks: empty queue => no rows', () => {
  const r = buildDailyTokenJonckheereTerpstraQuartileBlocks([], {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('buildDailyTokenJonckheereTerpstraQuartileBlocks: single source with strict trend has jtZ > 0', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 24; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', (i + 1) * 1000));
  }
  const r = buildDailyTokenJonckheereTerpstraQuartileBlocks(queue, {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.jtZ > 3);
  assert.ok(r.sources[0]!.jtPValue < 0.01);
  assert.equal(r.sources[0]!.jtBlockSizes.length, 4);
});

test('buildDailyTokenJonckheereTerpstraQuartileBlocks: rejects min-tenure-days < 20', () => {
  assert.throws(() =>
    buildDailyTokenJonckheereTerpstraQuartileBlocks([], { minTenureDays: 15 }),
  );
});

test('buildDailyTokenJonckheereTerpstraQuartileBlocks: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenJonckheereTerpstraQuartileBlocks([], {
      sort: 'bogus' as never,
    }),
  );
});

test('buildDailyTokenJonckheereTerpstraQuartileBlocks: invalid hour_start surfaces as droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src-a', 1000),
    ql(dayIso(0), 'src-a', 1000),
  ];
  const r = buildDailyTokenJonckheereTerpstraQuartileBlocks(queue, {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenJonckheereTerpstraQuartileBlocks: top cap surfaces as droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 24; i += 1) {
      queue.push(ql(dayIso(i), src, (i + 1) * 1000));
    }
  }
  const r = buildDailyTokenJonckheereTerpstraQuartileBlocks(queue, {
    top: 2,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenJonckheereTerpstraQuartileBlocks: source filter narrows', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b']) {
    for (let i = 0; i < 24; i += 1) {
      queue.push(ql(dayIso(i), src, (i + 1) * 1000));
    }
  }
  const r = buildDailyTokenJonckheereTerpstraQuartileBlocks(queue, {
    source: 'a',
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 24);
});

// ---------- aggregateJonckheereTerpstraQuartileBlocks ----------

test('aggregateJonckheereTerpstraQuartileBlocks: empty rows => default neutral', () => {
  const a = aggregateJonckheereTerpstraQuartileBlocks([]);
  assert.equal(a.rowsUsed, 0);
  assert.equal(a.stoufferZ, 0);
  assert.equal(a.stoufferTwoSidedPValue, 1);
});

test('aggregateJonckheereTerpstraQuartileBlocks: averages signed jtZ via Stouffer', () => {
  const a = aggregateJonckheereTerpstraQuartileBlocks([
    { jtZ: 2, jtPValue: 0.04, nTenureDays: 30 },
    { jtZ: 4, jtPValue: 0.0001, nTenureDays: 30 },
  ]);
  assert.equal(a.rowsUsed, 2);
  assert.ok(Math.abs(a.stoufferZ - 6 / Math.sqrt(2)) < 1e-10);
  assert.equal(a.meanJtZ, 3);
});

test('aggregateJonckheereTerpstraQuartileBlocks: skips malformed', () => {
  const a = aggregateJonckheereTerpstraQuartileBlocks([
    { jtZ: Number.NaN, jtPValue: 0.5, nTenureDays: 30 },
    { jtZ: 1, jtPValue: 0, nTenureDays: 30 },
    { jtZ: 1, jtPValue: 0.5, nTenureDays: 10 }, // below n>=20
  ]);
  assert.equal(a.rowsUsed, 0);
  assert.equal(a.rowsSkipped, 3);
});
