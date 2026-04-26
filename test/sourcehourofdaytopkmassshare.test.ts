import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceHourTopKMassShare,
  sumTopK,
} from '../src/sourcehourofdaytopkmassshare.js';
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

// ---- sumTopK ----------------------------------------------------------

test('sumTopK: empty -> 0', () => {
  assert.equal(sumTopK([], 3), 0);
});

test('sumTopK: k=0 -> 0', () => {
  assert.equal(sumTopK([1, 2, 3], 0), 0);
});

test('sumTopK: k larger than length clamps', () => {
  assert.equal(sumTopK([1, 2, 3], 10), 6);
});

test('sumTopK: picks largest k', () => {
  assert.equal(sumTopK([5, 1, 9, 3, 7, 2], 3), 9 + 7 + 5);
});

test('sumTopK: handles ties', () => {
  assert.equal(sumTopK([4, 4, 4, 4], 2), 8);
});

// ---- buildSourceHourTopKMassShare -------------------------------------

test('build: uniform across all 24 hours -> share_K = K/24', () => {
  // One row per hour-of-day for src-a (UTC).
  const queue: QueueLine[] = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    queue.push(ql(`2026-04-20T${hh}:00:00.000Z`, 'src-a', 100));
  }
  const r = buildSourceHourTopKMassShare(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minHours: 1,
    topHours: 3,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nHours, 24);
  // 3 of 24 hours, each carries 100/2400 = 1/24.
  assert.ok(Math.abs(row.topKShare - 3 / 24) < 1e-12);
  assert.equal(row.uniformBaseline, 3 / 24);
  assert.equal(r.uniformBaseline, 3 / 24);
});

test('build: single-hour source -> filtered by min-hours=2 default', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildSourceHourTopKMassShare(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.droppedBelowMinHours, 1);
  assert.equal(r.sources.length, 0);
});

test('build: single-hour source with min-hours=1 -> share = 1', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildSourceHourTopKMassShare(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minHours: 1,
    topHours: 3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.topKShare, 1);
  assert.equal(r.sources[0]!.nHours, 1);
  assert.equal(r.sources[0]!.topHourBuckets.length, 1);
});

test('build: deterministic top-K computation', () => {
  // src-a: hour 5 -> 1000, hour 10 -> 500, hour 15 -> 300, hour 20 -> 200; total 2000.
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1000),
    ql('2026-04-20T10:00:00.000Z', 'src-a', 500),
    ql('2026-04-20T15:00:00.000Z', 'src-a', 300),
    ql('2026-04-20T20:00:00.000Z', 'src-a', 200),
  ];
  const r = buildSourceHourTopKMassShare(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minHours: 1,
    topHours: 3,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.totalTokens, 2000);
  assert.equal(s.nHours, 4);
  // Top-3: 1000 + 500 + 300 = 1800; share = 0.9.
  assert.ok(Math.abs(s.topKShare - 0.9) < 1e-12);
  assert.deepEqual(
    s.topHourBuckets.map((b) => b.hour),
    [5, 10, 15],
  );
});

test('build: tie-break in top-K picks lower hour first', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T03:00:00.000Z', 'src-a', 100),
    ql('2026-04-20T07:00:00.000Z', 'src-a', 100),
    ql('2026-04-20T11:00:00.000Z', 'src-a', 100),
    ql('2026-04-20T15:00:00.000Z', 'src-a', 100),
  ];
  const r = buildSourceHourTopKMassShare(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minHours: 1,
    topHours: 2,
  });
  const s = r.sources[0]!;
  assert.deepEqual(
    s.topHourBuckets.map((b) => b.hour),
    [3, 7],
  );
});

test('build: minTokens drops sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 100),
    ql('2026-04-20T06:00:00.000Z', 'src-a', 100),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-20T06:00:00.000Z', 'src-b', 5000),
  ];
  const r = buildSourceHourTopKMassShare(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minHours: 1,
    topHours: 3,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-b');
});

test('build: source filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1000),
    ql('2026-04-20T06:00:00.000Z', 'src-a', 1000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 1000),
    ql('2026-04-20T06:00:00.000Z', 'src-b', 1000),
  ];
  const r = buildSourceHourTopKMassShare(queue, {
    generatedAt: GEN,
    source: 'src-a',
    minTokens: 0,
    minHours: 1,
    topHours: 3,
  });
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
});

test('build: window filter (since/until)', () => {
  const queue: QueueLine[] = [
    ql('2026-04-19T05:00:00.000Z', 'src-a', 1000), // before window
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1000),
    ql('2026-04-20T06:00:00.000Z', 'src-a', 1000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 1000), // at/after until -> dropped
  ];
  const r = buildSourceHourTopKMassShare(queue, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-21T00:00:00.000Z',
    minTokens: 0,
    minHours: 1,
    topHours: 3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalTokens, 2000);
});

test('build: drops invalid hour_start and non-positive tokens', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src-a', 1000),
    ql('2026-04-20T05:00:00.000Z', 'src-a', 0),
    ql('2026-04-20T05:00:00.000Z', 'src-a', -50),
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1000),
    ql('2026-04-20T06:00:00.000Z', 'src-a', 1000),
  ];
  const r = buildSourceHourTopKMassShare(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minHours: 1,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalTokens, 2000);
});

test('build: top cap applied after sort', () => {
  const queue: QueueLine[] = [];
  // src-a concentrated, src-b uniform-ish, src-c medium.
  // src-a all in hour 5
  for (let i = 0; i < 5; i++) {
    queue.push(ql(`2026-04-2${i}T05:00:00.000Z`, 'src-a', 1000));
  }
  queue.push(ql('2026-04-20T06:00:00.000Z', 'src-a', 1)); // 2 hours so passes
  // src-b across many hours
  for (let h = 0; h < 12; h++) {
    const hh = String(h).padStart(2, '0');
    queue.push(ql(`2026-04-20T${hh}:00:00.000Z`, 'src-b', 100));
  }
  // src-c
  queue.push(ql('2026-04-20T03:00:00.000Z', 'src-c', 500));
  queue.push(ql('2026-04-20T04:00:00.000Z', 'src-c', 500));
  queue.push(ql('2026-04-20T15:00:00.000Z', 'src-c', 200));
  const r = buildSourceHourTopKMassShare(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minHours: 1,
    topHours: 3,
    top: 2,
  });
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources.length, 2);
  // Sorted by share desc: src-a (~1.0) is first.
  assert.equal(r.sources[0]!.source, 'src-a');
});

test('build: sort=tokens orders by total mass', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1000),
    ql('2026-04-20T06:00:00.000Z', 'src-a', 1000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 50000),
    ql('2026-04-20T06:00:00.000Z', 'src-b', 50000),
  ];
  const r = buildSourceHourTopKMassShare(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minHours: 1,
    sort: 'tokens',
  });
  assert.equal(r.sources[0]!.source, 'src-b');
});

test('build: validation errors', () => {
  assert.throws(
    () => buildSourceHourTopKMassShare([], { topHours: 0 }),
    /topHours must be an integer in \[1, 24\]/,
  );
  assert.throws(
    () => buildSourceHourTopKMassShare([], { topHours: 25 }),
    /topHours/,
  );
  assert.throws(
    () => buildSourceHourTopKMassShare([], { minTokens: -1 }),
    /minTokens/,
  );
  assert.throws(
    () => buildSourceHourTopKMassShare([], { minHours: 0 }),
    /minHours/,
  );
  assert.throws(
    () => buildSourceHourTopKMassShare([], { top: -1 }),
    /top/,
  );
  assert.throws(
    () =>
      buildSourceHourTopKMassShare([], {
        // @ts-expect-error
        sort: 'nope',
      }),
    /sort must be one of/,
  );
  assert.throws(
    () => buildSourceHourTopKMassShare([], { since: 'nope' }),
    /invalid since/,
  );
});

test('build: echoes uniformBaseline = K/24 in report', () => {
  const r = buildSourceHourTopKMassShare([], {
    generatedAt: GEN,
    topHours: 6,
  });
  assert.equal(r.topHoursK, 6);
  assert.equal(r.uniformBaseline, 0.25);
});
