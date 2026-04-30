import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenZengaIndex,
  zengaOfVector,
} from '../src/dailytokenzengaindex.js';
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

const GEN = '2026-04-30T12:00:00.000Z';

// ---- zengaOfVector --------------------------------------------------------

test('zengaOfVector: empty -> 0', () => {
  const r = zengaOfVector([]);
  assert.equal(r.zenga, 0);
  assert.equal(r.maxU, 0);
  assert.equal(r.argmaxK, 0);
});

test('zengaOfVector: singleton -> 0 (n<2 ill-defined)', () => {
  const r = zengaOfVector([42]);
  assert.equal(r.zenga, 0);
  assert.equal(r.argmaxK, 0);
});

test('zengaOfVector: all zeros -> 0', () => {
  const r = zengaOfVector([0, 0, 0, 0]);
  assert.equal(r.zenga, 0);
});

test('zengaOfVector: uniform -> 0', () => {
  const r = zengaOfVector([10, 10, 10, 10]);
  assert.ok(Math.abs(r.zenga) < 1e-12);
  assert.ok(Math.abs(r.maxU) < 1e-12);
});

test('zengaOfVector: max-skew (only top is nonzero) -> 1', () => {
  // n=5; for k=1..4 lower-mean = 0 so u(k) = 1. Z = 1.
  const v = [0, 0, 0, 0, 100];
  const r = zengaOfVector(v);
  assert.ok(Math.abs(r.zenga - 1) < 1e-12);
  assert.ok(Math.abs(r.maxU - 1) < 1e-12);
});

test('zengaOfVector: rejects negative or non-finite', () => {
  assert.throws(() => zengaOfVector([1, -1]));
  assert.throws(() => zengaOfVector([1, NaN]));
  assert.throws(() => zengaOfVector([1, Infinity]));
});

test('zengaOfVector: order-invariant', () => {
  const a = [10, 1, 2, 3, 7];
  const b = [3, 7, 1, 10, 2];
  const za = zengaOfVector(a);
  const zb = zengaOfVector(b);
  assert.ok(Math.abs(za.zenga - zb.zenga) < 1e-12);
});

test('zengaOfVector: known two-point case [1, 3]', () => {
  // n=2, k=1: M^- = 1, M^+ = 3, u(1) = 1 - 1/3 = 2/3.
  // Z = 2/3.
  const r = zengaOfVector([1, 3]);
  assert.ok(Math.abs(r.zenga - 2 / 3) < 1e-12);
  assert.equal(r.argmaxK, 1);
});

test('zengaOfVector: bounded in [0, 1]', () => {
  const cases = [
    [1, 1, 1, 1, 1, 1],
    [1, 2, 3, 4, 5],
    [0, 0, 0, 1, 1000000],
    [10, 10, 10, 10, 10000],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5000000],
  ];
  for (const c of cases) {
    const r = zengaOfVector(c);
    assert.ok(r.zenga >= 0 && r.zenga <= 1, `zenga out of range: ${r.zenga}`);
    assert.ok(r.maxU >= 0 && r.maxU <= 1);
  }
});

test('zengaOfVector: argmaxK records the widest-gap cutpoint', () => {
  // [1,1,1,100,100]: k=3 puts the entire low cluster vs entire high
  // cluster, maximising u(k).
  const r = zengaOfVector([1, 1, 1, 100, 100]);
  assert.equal(r.argmaxK, 3);
});

// ---- builder: shape and filters ------------------------------------------

test('buildDailyTokenZengaIndex: empty queue -> empty report', () => {
  const r = buildDailyTokenZengaIndex([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.minDays, 2);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.sort, 'zenga');
});

test('buildDailyTokenZengaIndex: single source, uniform days -> Z ~ 0', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-23T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src-a');
  assert.equal(row.nDays, 4);
  assert.ok(Math.abs(row.zenga) < 1e-12);
  assert.equal(row.totalTokens, 20000);
});

test('buildDailyTokenZengaIndex: single source, max-skew days -> Z ~ 1', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-23T05:00:00.000Z', 'src-a', 1_000_000),
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  const row = r.sources[0]!;
  assert.equal(row.nDays, 4);
  assert.ok(row.zenga > 0.99);
  assert.equal(row.maxDay, '2026-04-23');
});

test('buildDailyTokenZengaIndex: collapses multi-hour rows on same day', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 'src-a', 2000),
    ql('2026-04-20T05:00:00.000Z', 'src-a', 3000),
    ql('2026-04-20T18:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 10000),
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  const row = r.sources[0]!;
  assert.equal(row.nDays, 2);
  assert.equal(row.totalTokens, 20000);
  // Two days with equal totals -> Z = 0
  assert.ok(Math.abs(row.zenga) < 1e-12);
});

test('buildDailyTokenZengaIndex: minTokens filter drops sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 100),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 100),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 5000),
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-b');
});

test('buildDailyTokenZengaIndex: minDays filter drops too-short sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 50000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-b', 5000),
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 2,
  });
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-b');
});

test('buildDailyTokenZengaIndex: source filter and droppedSourceFilter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 5000),
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    source: 'src-b',
  });
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-b');
});

test('buildDailyTokenZengaIndex: time window filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-19T05:00:00.000Z', 'src-a', 5000), // before
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 5000), // at-until-exclusive
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-22T00:00:00.000Z',
  });
  const row = r.sources[0]!;
  assert.equal(row.nDays, 2);
  assert.equal(row.totalTokens, 10000);
});

test('buildDailyTokenZengaIndex: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src-a', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('buildDailyTokenZengaIndex: non-positive tokens dropped', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 0),
    ql('2026-04-20T06:00:00.000Z', 'src-a', -10),
    ql('2026-04-20T07:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources[0]!.totalTokens, 10000);
});

test('buildDailyTokenZengaIndex: sort=zenga is default and DESC', () => {
  const queue: QueueLine[] = [
    // src-a uniform -> low Z
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 5000),
    // src-b skewed -> high Z
    ql('2026-04-20T05:00:00.000Z', 'src-b', 1),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 1),
    ql('2026-04-22T05:00:00.000Z', 'src-b', 100000),
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources[0]!.source, 'src-b');
  assert.equal(r.sources[1]!.source, 'src-a');
});

test('buildDailyTokenZengaIndex: sort=tokens DESC', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 1000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 50000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 50000),
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    sort: 'tokens',
  });
  assert.equal(r.sources[0]!.source, 'src-b');
  assert.equal(r.sources[1]!.source, 'src-a');
});

test('buildDailyTokenZengaIndex: top cap drops tail', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-c', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-c', 5000),
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources.length, 2);
});

test('buildDailyTokenZengaIndex: minZenga filter drops low-skew sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 1),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 1),
    ql('2026-04-22T05:00:00.000Z', 'src-b', 100000),
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minZenga: 0.5,
  });
  assert.equal(r.droppedBelowMinZenga, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-b');
  assert.equal(r.minZenga, 0.5);
});

test('buildDailyTokenZengaIndex: rejects bad knobs', () => {
  assert.throws(() => buildDailyTokenZengaIndex([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenZengaIndex([], { minDays: 1 }));
  assert.throws(() => buildDailyTokenZengaIndex([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenZengaIndex([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenZengaIndex([], { sort: 'nope' as 'zenga' }),
  );
  assert.throws(() => buildDailyTokenZengaIndex([], { since: 'not-a-date' }));
  assert.throws(() => buildDailyTokenZengaIndex([], { until: 'not-a-date' }));
  assert.throws(() => buildDailyTokenZengaIndex([], { minZenga: -0.1 }));
  assert.throws(() => buildDailyTokenZengaIndex([], { minZenga: 1.1 }));
});

test('buildDailyTokenZengaIndex: orthogonality vs gini -- same total/days, different shape', () => {
  // Two day-vectors with the same n=5 and same total mass but
  // different mid-cutpoint behaviour. Zenga should pick this up
  // even though Gini is similar.
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-23T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-24T05:00:00.000Z', 'src-a', 96),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 1),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 25),
    ql('2026-04-22T05:00:00.000Z', 'src-b', 50),
    ql('2026-04-23T05:00:00.000Z', 'src-b', 75),
    // Same total = 100 across 5 days, but graded ramp instead of spike.
    ql('2026-04-24T05:00:00.000Z', 'src-b', -149 + 100), // = -49 -> dropped non-positive
    ql('2026-04-24T05:00:00.000Z', 'src-b', -100 + 100), // = 0 -> dropped non-positive
    ql('2026-04-24T05:00:00.000Z', 'src-b', -50 + 100), // = 50 -> kept
  ];
  const r = buildDailyTokenZengaIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  // src-a all-low + one-mega-day Zenga must be near 1.
  // src-b graded ramp Zenga must be moderate (~0.5 range).
  const a = r.sources.find((s) => s.source === 'src-a')!;
  const b = r.sources.find((s) => s.source === 'src-b')!;
  assert.ok(a.zenga > 0.9, `src-a zenga should be high (got ${a.zenga})`);
  assert.ok(
    b.zenga < a.zenga - 0.2,
    `src-b zenga (${b.zenga}) should be meaningfully below src-a (${a.zenga})`,
  );
});
