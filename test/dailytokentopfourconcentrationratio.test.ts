import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenTopFourConcentrationRatio,
  topFourConcentrationRatioOfVector,
} from '../src/dailytokentopfourconcentrationratio.js';
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

test('primitive: empty -> degenerate, cr4=0, total=0', () => {
  const r = topFourConcentrationRatioOfVector([]);
  assert.equal(r.cr4, 0);
  assert.equal(r.topMass, 0);
  assert.equal(r.total, 0);
  assert.equal(r.degenerate, true);
});

test('primitive: D=[1..10] closed-form CR4 = 34/55', () => {
  const r = topFourConcentrationRatioOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.topMass, 34);
  assert.equal(r.total, 55);
  assert.ok(Math.abs(r.cr4 - 34 / 55) < 1e-15);
  assert.ok(Math.abs(r.lowerBound - 0.4) < 1e-15);
  assert.ok(Math.abs(r.slack - (34 / 55 - 0.4)) < 1e-15);
  assert.equal(r.degenerate, false);
});

test('primitive: perfectly flat vector -> cr4 = 4/n exactly (lower bound)', () => {
  const r = topFourConcentrationRatioOfVector([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
  assert.ok(Math.abs(r.cr4 - 0.4) < 1e-15);
  assert.ok(Math.abs(r.cr4 - r.lowerBound) < 1e-15);
  assert.ok(Math.abs(r.slack) < 1e-15);
});

test('primitive: top-4 carries ~100% -> cr4 -> 1 (upper bound)', () => {
  const v = [100, 100, 100, 100, 1e-9, 1e-9, 1e-9, 1e-9, 1e-9, 1e-9];
  const r = topFourConcentrationRatioOfVector(v);
  assert.ok(r.cr4 > 0.9999999);
  assert.ok(r.cr4 <= 1);
});

test('primitive: scale invariance -- CR4(c*v) === CR4(v)', () => {
  const base = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r1 = topFourConcentrationRatioOfVector(base);
  const r2 = topFourConcentrationRatioOfVector(base.map((x) => x * 1e6));
  assert.ok(Math.abs(r1.cr4 - r2.cr4) < 1e-15);
});

test('primitive: permutation invariance', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const b = [10, 1, 9, 2, 8, 3, 7, 4, 6, 5];
  const r1 = topFourConcentrationRatioOfVector(a);
  const r2 = topFourConcentrationRatioOfVector(b);
  assert.ok(Math.abs(r1.cr4 - r2.cr4) < 1e-15);
});

test('primitive: throws on negative input', () => {
  assert.throws(() => topFourConcentrationRatioOfVector([1, 2, -3, 4, 5]));
});

test('primitive: throws on zero input', () => {
  assert.throws(() => topFourConcentrationRatioOfVector([1, 2, 0, 4, 5]));
});

test('primitive: throws on NaN input', () => {
  assert.throws(() => topFourConcentrationRatioOfVector([1, 2, NaN, 4, 5]));
});

test('primitive: n<5 -> degenerate=true', () => {
  const r = topFourConcentrationRatioOfVector([1, 2, 3, 4]);
  assert.equal(r.degenerate, true);
  assert.equal(r.cr4, 1);
});

test('primitive: rank-flip witness vs Gini-style measures (A vs B)', () => {
  const A = [10, 10, 10, 10, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
  const B = [100, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const ra = topFourConcentrationRatioOfVector(A);
  const rb = topFourConcentrationRatioOfVector(B);
  assert.ok(Math.abs(ra.cr4 - 40 / 40.6) < 1e-12);
  assert.ok(Math.abs(rb.cr4 - 103 / 109) < 1e-12);
  assert.ok(ra.cr4 > rb.cr4);
});

test('builder: rejects minDays < 5', () => {
  assert.throws(() =>
    buildDailyTokenTopFourConcentrationRatio([], { minDays: 4, generatedAt: GEN }),
  );
});

test('builder: rejects minCr4 outside [0,1]', () => {
  assert.throws(() =>
    buildDailyTokenTopFourConcentrationRatio([], { minCr4: 1.5, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenTopFourConcentrationRatio([], { minCr4: -0.1, generatedAt: GEN }),
  );
});

test('builder: emits per-source row with bound-correct cr4 / lowerBound / slack', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 6; d += 1) {
    queue.push(ql(`2026-05-0${d}T10:00:00Z`, 'alpha', d * 1000));
  }
  const r = buildDailyTokenTopFourConcentrationRatio(queue, {
    minTokens: 1,
    minDays: 5,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nDays, 6);
  assert.equal(row.topMass, 18000);
  assert.equal(row.totalTokens, 21000);
  assert.ok(Math.abs(row.cr4 - 18000 / 21000) < 1e-12);
  assert.ok(Math.abs(row.lowerBound - 4 / 6) < 1e-12);
  assert.ok(Math.abs(row.slack - (18000 / 21000 - 4 / 6)) < 1e-12);
});

test('builder: drops sources with nDays < minDays', () => {
  const queue: QueueLine[] = [
    ql('2026-05-01T10:00:00Z', 'a', 1000),
    ql('2026-05-02T10:00:00Z', 'a', 1000),
    ql('2026-05-03T10:00:00Z', 'a', 1000),
    ql('2026-05-04T10:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenTopFourConcentrationRatio(queue, {
    minTokens: 1,
    minDays: 5,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDays, 1);
});

test('builder: sort=cr4 desc with multiple sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 5; d += 1) {
    queue.push(ql(`2026-05-0${d}T10:00:00Z`, 'flat', 1000));
  }
  for (let d = 1; d <= 4; d += 1) {
    queue.push(ql(`2026-05-0${d}T10:00:00Z`, 'spike', 100000));
  }
  queue.push(ql('2026-05-05T10:00:00Z', 'spike', 1));
  const r = buildDailyTokenTopFourConcentrationRatio(queue, {
    minTokens: 1,
    minDays: 5,
    sort: 'cr4',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'spike');
  assert.equal(r.sources[1]!.source, 'flat');
  assert.ok(r.sources[0]!.cr4 > r.sources[1]!.cr4);
  assert.ok(Math.abs(r.sources[1]!.cr4 - 0.8) < 1e-12);
});

test('builder: minCr4 filter drops below-threshold sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 5; d += 1) {
    queue.push(ql(`2026-05-0${d}T10:00:00Z`, 'flat', 1000));
  }
  const r = buildDailyTokenTopFourConcentrationRatio(queue, {
    minTokens: 1,
    minDays: 5,
    minCr4: 0.95,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinCr4, 1);
});

// ---- refinement: concentrationRegime + normalisedSlack ----------------

test('refinement: flat vector -> low regime, normalisedSlack ~ 0', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 8; d += 1) {
    queue.push(ql(`2026-05-0${d}T10:00:00Z`, 'flat', 1000));
  }
  const r = buildDailyTokenTopFourConcentrationRatio(queue, {
    minTokens: 1,
    minDays: 5,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.concentrationRegime, 'low');
  assert.ok(row.normalisedSlack < 1e-12);
});

test('refinement: top-heavy vector -> high regime, normalisedSlack -> 1', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 4; d += 1) {
    queue.push(ql(`2026-05-0${d}T10:00:00Z`, 'spike', 1000000));
  }
  for (let d = 5; d <= 10; d += 1) {
    queue.push(ql(`2026-05-${String(d).padStart(2, '0')}T10:00:00Z`, 'spike', 1));
  }
  const r = buildDailyTokenTopFourConcentrationRatio(queue, {
    minTokens: 1,
    minDays: 5,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.concentrationRegime, 'high');
  assert.ok(row.normalisedSlack > 0.99);
});

test('refinement: normalisedSlack = slack / (1 - lowerBound) closed-form', () => {
  // n=10, vector [1..10]: cr4=34/55, lowerBound=0.4, slack = 34/55 - 0.4
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 10; d += 1) {
    queue.push(
      ql(`2026-05-${String(d).padStart(2, '0')}T10:00:00Z`, 'tri', d * 1000),
    );
  }
  const r = buildDailyTokenTopFourConcentrationRatio(queue, {
    minTokens: 1,
    minDays: 5,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  const expected = (34 / 55 - 0.4) / (1 - 0.4);
  assert.ok(Math.abs(row.normalisedSlack - expected) < 1e-12);
});

test('refinement: medium regime in [1/3, 2/3) of headroom', () => {
  // construct so that normalisedSlack ~ 0.5: top-4 mass ~50% of available headroom
  // n=10, lowerBound=0.4, headroom=0.6, target slack=0.3 -> cr4=0.7
  // top-4 = 0.7 * total. 4 days at value 7, 6 days at value 2: total=4*7+6*2=40
  // top-4 = 28; cr4 = 28/40 = 0.7. slack = 0.3. normSlack = 0.5.
  const queue: QueueLine[] = [];
  const vals = [7, 7, 7, 7, 2, 2, 2, 2, 2, 2];
  for (let d = 0; d < 10; d += 1) {
    queue.push(
      ql(`2026-05-${String(d + 1).padStart(2, '0')}T10:00:00Z`, 'mid', vals[d]! * 1000),
    );
  }
  const r = buildDailyTokenTopFourConcentrationRatio(queue, {
    minTokens: 1,
    minDays: 5,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.concentrationRegime, 'medium');
  assert.ok(Math.abs(row.normalisedSlack - 0.5) < 1e-12);
});
