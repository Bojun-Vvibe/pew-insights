import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenPielouEvenness,
  pielouEvennessOfVector,
} from '../src/dailytokenpielouevenness.js';
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

const GEN = '2026-05-04T12:00:00.000Z';

test('primitive: empty -> degenerate, H=0, total=0', () => {
  const r = pielouEvennessOfVector([]);
  assert.equal(r.shannonEntropy, 0);
  assert.equal(r.evenness, 0);
  assert.equal(r.total, 0);
  assert.equal(r.degenerate, true);
});

test('primitive: n=1 -> degenerate, H=0, evenness=0, nEff=1', () => {
  const r = pielouEvennessOfVector([42]);
  assert.equal(r.shannonEntropy, 0);
  assert.equal(r.evenness, 0);
  assert.equal(r.maxEntropy, 0);
  assert.equal(r.effectiveDaysShannon, 1);
  assert.equal(r.degenerate, true);
});

test('primitive: perfectly flat vector -> J=1 exactly, H=ln(n), nEff=n', () => {
  const r = pielouEvennessOfVector([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
  assert.ok(Math.abs(r.shannonEntropy - Math.log(10)) < 1e-15);
  assert.ok(Math.abs(r.maxEntropy - Math.log(10)) < 1e-15);
  assert.ok(Math.abs(r.evenness - 1) < 1e-15);
  assert.ok(Math.abs(r.effectiveDaysShannon - 10) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('primitive: D=[1..10] closed-form H = ln(55) - (1/55)*sum k*ln(k)', () => {
  const r = pielouEvennessOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  let kLnK = 0;
  for (let k = 1; k <= 10; k += 1) kLnK += k * Math.log(k);
  const expectedH = Math.log(55) - kLnK / 55;
  const expectedJ = expectedH / Math.log(10);
  assert.equal(r.total, 55);
  assert.ok(Math.abs(r.shannonEntropy - expectedH) < 1e-14);
  assert.ok(Math.abs(r.evenness - expectedJ) < 1e-14);
  assert.ok(Math.abs(r.effectiveDaysShannon - Math.exp(expectedH)) < 1e-12);
  // Hill-number ordering sanity: q=1 (Shannon) >= q=2 (inverse-Simpson).
  const inverseSimpson = 3025 / 385;
  assert.ok(r.effectiveDaysShannon > inverseSimpson);
});

test('primitive: monopoly day -> H -> 0, J -> 0, nEff -> 1', () => {
  const v = [1e12, 1e-6, 1e-6, 1e-6, 1e-6, 1e-6];
  const r = pielouEvennessOfVector(v);
  assert.ok(r.shannonEntropy < 1e-10);
  assert.ok(r.evenness < 1e-10);
  assert.ok(r.effectiveDaysShannon < 1.0001);
  assert.ok(r.effectiveDaysShannon >= 1);
});

test('primitive: scale invariance -- J(c*v) === J(v)', () => {
  const base = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r1 = pielouEvennessOfVector(base);
  const r2 = pielouEvennessOfVector(base.map((x) => x * 1e6));
  assert.ok(Math.abs(r1.evenness - r2.evenness) < 1e-14);
  assert.ok(Math.abs(r1.shannonEntropy - r2.shannonEntropy) < 1e-14);
});

test('primitive: permutation invariance', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const b = [10, 1, 9, 2, 8, 3, 7, 4, 6, 5];
  const r1 = pielouEvennessOfVector(a);
  const r2 = pielouEvennessOfVector(b);
  assert.ok(Math.abs(r1.evenness - r2.evenness) < 1e-15);
  assert.ok(Math.abs(r1.shannonEntropy - r2.shannonEntropy) < 1e-15);
});

test('primitive: rejects non-positive / non-finite values', () => {
  assert.throws(() => pielouEvennessOfVector([1, 0, 2]));
  assert.throws(() => pielouEvennessOfVector([1, -1, 2]));
  assert.throws(() => pielouEvennessOfVector([1, NaN, 2]));
  assert.throws(() => pielouEvennessOfVector([1, Infinity, 2]));
});

test('primitive: J always in [0, 1]', () => {
  const cases: number[][] = [
    [1, 1, 1, 1],
    [1, 2, 3, 4, 5],
    [100, 1, 1, 1],
    [1, 1, 1, 100],
    [50, 50, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
  ];
  for (const c of cases) {
    const r = pielouEvennessOfVector(c);
    assert.ok(r.evenness >= 0 && r.evenness <= 1, `J out of range for ${c}`);
  }
});

test('builder: empty queue -> totalSources=0, sources=[]', () => {
  const r = buildDailyTokenPielouEvenness([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('builder: single source single day -> dropped (n<2)', () => {
  const queue: QueueLine[] = [ql('2026-05-01T00:00:00Z', 'a', 5000)];
  const r = buildDailyTokenPielouEvenness(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDays, 1);
});

test('builder: flat 3-day source -> evenness=1', () => {
  const queue: QueueLine[] = [
    ql('2026-05-01T00:00:00Z', 'a', 3000),
    ql('2026-05-02T00:00:00Z', 'a', 3000),
    ql('2026-05-03T00:00:00Z', 'a', 3000),
  ];
  const r = buildDailyTokenPielouEvenness(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(Math.abs(r.sources[0].evenness - 1) < 1e-15);
  assert.ok(Math.abs(r.sources[0].effectiveDaysShannon - 3) < 1e-12);
  assert.equal(r.sources[0].nDays, 3);
  assert.equal(r.sources[0].totalTokens, 9000);
});

test('builder: bad hour_start surfaces as droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 5000),
    ql('2026-05-01T00:00:00Z', 'a', 5000),
    ql('2026-05-02T00:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenPielouEvenness(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('builder: non-positive total_tokens surfaces as droppedNonPositiveTokens', () => {
  const queue: QueueLine[] = [
    ql('2026-05-01T00:00:00Z', 'a', 0),
    ql('2026-05-01T00:00:00Z', 'a', 3000),
    ql('2026-05-02T00:00:00Z', 'a', 3000),
  ];
  const r = buildDailyTokenPielouEvenness(queue, { generatedAt: GEN });
  assert.equal(r.droppedNonPositiveTokens, 1);
});

test('builder: source filter restricts and drops the rest', () => {
  const queue: QueueLine[] = [
    ql('2026-05-01T00:00:00Z', 'a', 5000),
    ql('2026-05-02T00:00:00Z', 'a', 5000),
    ql('2026-05-01T00:00:00Z', 'b', 5000),
    ql('2026-05-02T00:00:00Z', 'b', 5000),
  ];
  const r = buildDailyTokenPielouEvenness(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.source, 'a');
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'a');
});

test('builder: sort=evenness ranks flat above skewed', () => {
  const queue: QueueLine[] = [
    // flat source
    ql('2026-05-01T00:00:00Z', 'flat', 5000),
    ql('2026-05-02T00:00:00Z', 'flat', 5000),
    ql('2026-05-03T00:00:00Z', 'flat', 5000),
    // skewed source
    ql('2026-05-01T00:00:00Z', 'skew', 100),
    ql('2026-05-02T00:00:00Z', 'skew', 100),
    ql('2026-05-03T00:00:00Z', 'skew', 100000),
  ];
  const r = buildDailyTokenPielouEvenness(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0].source, 'flat');
  assert.ok(r.sources[0].evenness > r.sources[1].evenness);
});

test('builder: minEvenness display filter', () => {
  const queue: QueueLine[] = [
    ql('2026-05-01T00:00:00Z', 'flat', 5000),
    ql('2026-05-02T00:00:00Z', 'flat', 5000),
    ql('2026-05-01T00:00:00Z', 'skew', 100),
    ql('2026-05-02T00:00:00Z', 'skew', 100000),
  ];
  const r = buildDailyTokenPielouEvenness(queue, {
    generatedAt: GEN,
    minEvenness: 0.5,
  });
  assert.equal(r.droppedBelowMinEvenness, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'flat');
});

test('builder: invalid options throw', () => {
  assert.throws(() => buildDailyTokenPielouEvenness([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenPielouEvenness([], { minDays: 1 }));
  assert.throws(() => buildDailyTokenPielouEvenness([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenPielouEvenness([], { minEvenness: 1.5 }),
  );
  assert.throws(() =>
    buildDailyTokenPielouEvenness([], {
      sort: 'bogus' as unknown as 'evenness',
    }),
  );
});

test('builder: deterministic with fixed generatedAt', () => {
  const queue: QueueLine[] = [
    ql('2026-05-01T00:00:00Z', 'a', 5000),
    ql('2026-05-02T00:00:00Z', 'a', 5000),
    ql('2026-05-03T00:00:00Z', 'a', 7000),
  ];
  const r1 = buildDailyTokenPielouEvenness(queue, { generatedAt: GEN });
  const r2 = buildDailyTokenPielouEvenness(queue, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});
