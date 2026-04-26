import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenGini,
  giniOfVector,
} from '../src/dailytokenginicoefficient.js';
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

const GEN = '2026-04-26T12:00:00.000Z';

// ---- giniOfVector ---------------------------------------------------------

test('giniOfVector: empty -> 0', () => {
  assert.equal(giniOfVector([]), 0);
});

test('giniOfVector: singleton -> 0', () => {
  assert.equal(giniOfVector([42]), 0);
});

test('giniOfVector: all zeros -> 0', () => {
  assert.equal(giniOfVector([0, 0, 0, 0]), 0);
});

test('giniOfVector: uniform -> 0', () => {
  assert.ok(Math.abs(giniOfVector([10, 10, 10, 10])) < 1e-12);
});

test('giniOfVector: max-skew (one nonzero) hits (n-1)/n', () => {
  const n = 5;
  const v = [0, 0, 0, 0, 100];
  // closed-form bound for max inequality with n samples
  const bound = (n - 1) / n;
  assert.ok(Math.abs(giniOfVector(v) - bound) < 1e-12);
});

test('giniOfVector: rejects negative or non-finite', () => {
  assert.throws(() => giniOfVector([1, -1]));
  assert.throws(() => giniOfVector([1, NaN]));
  assert.throws(() => giniOfVector([1, Infinity]));
});

test('giniOfVector: order-invariant', () => {
  const a = [10, 1, 2, 3, 7];
  const b = [3, 7, 1, 10, 2];
  assert.ok(Math.abs(giniOfVector(a) - giniOfVector(b)) < 1e-12);
});

test('giniOfVector: known two-point case [1, 3] -> 0.25', () => {
  // Gini of [1,3]: |1-3| / (2*2*4) = 2/16 = 0.125. With n=2 sorted form:
  // (2*(1*1 + 2*3) - 3*4) / (2*4) = (2*7 - 12) / 8 = 2/8 = 0.25
  // The 0.25 figure is the classic textbook result without the n/(n-1)
  // correction, which matches our implementation.
  assert.ok(Math.abs(giniOfVector([1, 3]) - 0.25) < 1e-12);
});

// ---- builder: shape and filters ------------------------------------------

test('buildDailyTokenGini: empty queue -> empty report', () => {
  const r = buildDailyTokenGini([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.minDays, 2);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.sort, 'gini');
});

test('buildDailyTokenGini: single source, uniform days -> gini ~ 0', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-23T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildDailyTokenGini(queue, { generatedAt: GEN, minTokens: 0 });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src-a');
  assert.equal(row.nDays, 4);
  assert.ok(Math.abs(row.gini) < 1e-12);
  assert.equal(row.totalTokens, 20000);
  assert.equal(row.maxDailyTokens, 5000);
  assert.ok(Math.abs(row.maxDayShare - 0.25) < 1e-12);
});

test('buildDailyTokenGini: single source, max-skew days', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-23T05:00:00.000Z', 'src-a', 1_000_000),
  ];
  const r = buildDailyTokenGini(queue, { generatedAt: GEN, minTokens: 0 });
  const row = r.sources[0]!;
  assert.equal(row.nDays, 4);
  // Heavy skew -> Gini close to (n-1)/n = 0.75
  assert.ok(row.gini > 0.74 && row.gini <= 0.75 + 1e-12);
  assert.equal(row.maxDay, '2026-04-23');
  assert.ok(row.maxDayShare > 0.999);
});

test('buildDailyTokenGini: collapses multi-hour rows on same day', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 'src-a', 2000),
    ql('2026-04-20T05:00:00.000Z', 'src-a', 3000),
    ql('2026-04-20T18:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 10000),
  ];
  const r = buildDailyTokenGini(queue, { generatedAt: GEN, minTokens: 0 });
  const row = r.sources[0]!;
  assert.equal(row.nDays, 2);
  assert.equal(row.totalTokens, 20000);
  // Two days with equal totals -> gini 0
  assert.ok(Math.abs(row.gini) < 1e-12);
});

test('buildDailyTokenGini: minTokens filter drops sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 100),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 100),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 5000),
  ];
  const r = buildDailyTokenGini(queue, { generatedAt: GEN, minTokens: 1000 });
  assert.equal(r.totalSources, 2);
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-b');
});

test('buildDailyTokenGini: minDays filter drops too-short sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 50000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-b', 5000),
  ];
  const r = buildDailyTokenGini(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 2,
  });
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-b');
});

test('buildDailyTokenGini: source filter and droppedSourceFilter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 5000),
  ];
  const r = buildDailyTokenGini(queue, {
    generatedAt: GEN,
    minTokens: 0,
    source: 'src-b',
  });
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-b');
});

test('buildDailyTokenGini: time window filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-19T05:00:00.000Z', 'src-a', 5000), // before
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 5000), // at-until-exclusive
  ];
  const r = buildDailyTokenGini(queue, {
    generatedAt: GEN,
    minTokens: 0,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-22T00:00:00.000Z',
  });
  const row = r.sources[0]!;
  assert.equal(row.nDays, 2);
  assert.equal(row.totalTokens, 10000);
});

test('buildDailyTokenGini: invalid hour_start counted as droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src-a', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildDailyTokenGini(queue, { generatedAt: GEN, minTokens: 0 });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('buildDailyTokenGini: non-positive tokens dropped', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 0),
    ql('2026-04-20T06:00:00.000Z', 'src-a', -10),
    ql('2026-04-20T07:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildDailyTokenGini(queue, { generatedAt: GEN, minTokens: 0 });
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources[0]!.totalTokens, 10000);
});

test('buildDailyTokenGini: sort=gini is default and DESC', () => {
  const queue: QueueLine[] = [
    // src-a uniform -> low gini
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 5000),
    // src-b skewed -> high gini
    ql('2026-04-20T05:00:00.000Z', 'src-b', 1),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 1),
    ql('2026-04-22T05:00:00.000Z', 'src-b', 100000),
  ];
  const r = buildDailyTokenGini(queue, { generatedAt: GEN, minTokens: 0 });
  assert.equal(r.sources[0]!.source, 'src-b');
  assert.equal(r.sources[1]!.source, 'src-a');
});

test('buildDailyTokenGini: sort=tokens DESC', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 1000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 50000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 50000),
  ];
  const r = buildDailyTokenGini(queue, {
    generatedAt: GEN,
    minTokens: 0,
    sort: 'tokens',
  });
  assert.equal(r.sources[0]!.source, 'src-b');
  assert.equal(r.sources[1]!.source, 'src-a');
});

test('buildDailyTokenGini: top cap drops tail', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-c', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-c', 5000),
  ];
  const r = buildDailyTokenGini(queue, {
    generatedAt: GEN,
    minTokens: 0,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources.length, 2);
});

test('buildDailyTokenGini: rejects bad knobs', () => {
  assert.throws(() => buildDailyTokenGini([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenGini([], { minDays: 0 }));
  assert.throws(() => buildDailyTokenGini([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenGini([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenGini([], { sort: 'nope' as 'gini' }),
  );
  assert.throws(() => buildDailyTokenGini([], { since: 'not-a-date' }));
  assert.throws(() => buildDailyTokenGini([], { until: 'not-a-date' }));
  assert.throws(() => buildDailyTokenGini([], { minGini: -0.1 }));
  assert.throws(() => buildDailyTokenGini([], { minGini: 1.1 }));
  assert.throws(() =>
    buildDailyTokenGini([], { minGini: Number.POSITIVE_INFINITY }),
  );
});

test('buildDailyTokenGini: minGini filter drops low-skew sources', () => {
  const queue: QueueLine[] = [
    // src-a uniform -> gini ~ 0
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 5000),
    // src-b skewed -> gini ~ (n-1)/n
    ql('2026-04-20T05:00:00.000Z', 'src-b', 1),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 1),
    ql('2026-04-22T05:00:00.000Z', 'src-b', 100000),
  ];
  const r = buildDailyTokenGini(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minGini: 0.5,
  });
  assert.equal(r.droppedBelowMinGini, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-b');
  assert.equal(r.minGini, 0.5);
});

test('buildDailyTokenGini: minGini=0 is no-op', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildDailyTokenGini(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minGini: 0,
  });
  assert.equal(r.droppedBelowMinGini, 0);
  assert.equal(r.sources.length, 1);
});
