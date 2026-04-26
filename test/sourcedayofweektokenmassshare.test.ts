import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceDayOfWeekTokenMassShare,
  normalizedShannonEntropy,
  dowName,
} from '../src/sourcedayofweektokenmassshare.js';
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

// ---- helpers ---------------------------------------------------------------

test('dowName: round-trips 0..6', () => {
  assert.equal(dowName(0), 'Sun');
  assert.equal(dowName(1), 'Mon');
  assert.equal(dowName(6), 'Sat');
  assert.equal(dowName(7), '?');
  assert.equal(dowName(-1), '?');
  assert.equal(dowName(1.5), '?');
});

test('normalizedShannonEntropy: empty / zero -> 0', () => {
  assert.equal(normalizedShannonEntropy([]), 0);
  assert.equal(normalizedShannonEntropy([0, 0, 0]), 0);
});

test('normalizedShannonEntropy: uniform 7-vector -> 1', () => {
  const v = [1, 1, 1, 1, 1, 1, 1];
  const h = normalizedShannonEntropy(v);
  assert.ok(Math.abs(h - 1) < 1e-12, `expected 1, got ${h}`);
});

test('normalizedShannonEntropy: all mass on one bin -> 0', () => {
  assert.equal(normalizedShannonEntropy([0, 0, 0, 100, 0, 0, 0]), 0);
});

test('normalizedShannonEntropy: monotone decreasing as concentration grows', () => {
  const uniform = normalizedShannonEntropy([10, 10, 10, 10, 10, 10, 10]);
  const slight = normalizedShannonEntropy([20, 10, 10, 10, 10, 10, 10]);
  const heavy = normalizedShannonEntropy([100, 1, 1, 1, 1, 1, 1]);
  assert.ok(uniform > slight, `${uniform} > ${slight}`);
  assert.ok(slight > heavy, `${slight} > ${heavy}`);
});

// ---- builder: validation ---------------------------------------------------

test('builder: rejects bad minTokens / top / sort / source / minWeekendShare', () => {
  assert.throws(() => buildSourceDayOfWeekTokenMassShare([], { minTokens: -1 }));
  assert.throws(() =>
    buildSourceDayOfWeekTokenMassShare([], { minTokens: Number.NaN }),
  );
  assert.throws(() => buildSourceDayOfWeekTokenMassShare([], { top: -1 }));
  assert.throws(() => buildSourceDayOfWeekTokenMassShare([], { top: 1.5 }));
  assert.throws(() =>
    // @ts-expect-error invalid sort key
    buildSourceDayOfWeekTokenMassShare([], { sort: 'bogus' }),
  );
  assert.throws(() =>
    buildSourceDayOfWeekTokenMassShare([], { minWeekendShare: -0.1 }),
  );
  assert.throws(() =>
    buildSourceDayOfWeekTokenMassShare([], { minWeekendShare: 1.1 }),
  );
  assert.throws(() =>
    buildSourceDayOfWeekTokenMassShare([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceDayOfWeekTokenMassShare([], { until: 'not-a-date' }),
  );
});

// ---- builder: empty input --------------------------------------------------

test('builder: empty queue -> empty report with sane defaults', () => {
  const r = buildSourceDayOfWeekTokenMassShare([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.ok(Math.abs(r.uniformBaseline - 1 / 7) < 1e-12);
  assert.ok(Math.abs(r.weekendUniformBaseline - 2 / 7) < 1e-12);
  assert.equal(r.minWeekendShare, 0);
});

// ---- builder: dow attribution ----------------------------------------------

test('builder: uses UTC day-of-week, not local', () => {
  // 2026-01-04 is Sunday in UTC. 2026-01-05 is Monday.
  // Put 1000 tokens on Sun, 500 on Mon for source X.
  const queue: QueueLine[] = [
    ql('2026-01-04T00:00:00Z', 'X', 1000),
    ql('2026-01-04T15:00:00Z', 'X', 0 + 1), // dropped: tt > 0 but small; still counts on Sun
    ql('2026-01-05T03:00:00Z', 'X', 500),
  ];
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  // Sun = 1001, Mon = 500, total = 1501
  assert.equal(row.totalTokens, 1501);
  assert.ok(row.shares[0]! > row.shares[1]!);
  assert.equal(row.dominantDow, 0); // Sunday
  // weekendShare = Sun share since Sat has nothing
  assert.ok(Math.abs(row.weekendShare - row.shares[0]!) < 1e-12);
});

test('builder: shares sum to 1 for each source', () => {
  const queue: QueueLine[] = [];
  // Spread some load over a full week
  const days = [
    '2026-01-04', // Sun
    '2026-01-05', // Mon
    '2026-01-06', // Tue
    '2026-01-07', // Wed
    '2026-01-08', // Thu
    '2026-01-09', // Fri
    '2026-01-10', // Sat
  ];
  for (let i = 0; i < days.length; i++) {
    queue.push(ql(`${days[i]}T12:00:00Z`, 'A', 1000 + i * 100));
    queue.push(ql(`${days[i]}T13:00:00Z`, 'B', 5000));
  }
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  for (const row of r.sources) {
    const sum = row.shares.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `shares sum = ${sum} for ${row.source}`);
  }
});

test('builder: source B is uniform -> entropy near 1, dominantShare near 1/7', () => {
  const queue: QueueLine[] = [];
  const days = [
    '2026-01-04',
    '2026-01-05',
    '2026-01-06',
    '2026-01-07',
    '2026-01-08',
    '2026-01-09',
    '2026-01-10',
  ];
  for (const d of days) {
    queue.push(ql(`${d}T12:00:00Z`, 'B', 5000));
  }
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 0,
    generatedAt: GEN,
  });
  const row = r.sources.find((s) => s.source === 'B')!;
  assert.ok(Math.abs(row.normalizedEntropy - 1) < 1e-12);
  assert.ok(Math.abs(row.dominantShare - 1 / 7) < 1e-12);
  assert.ok(Math.abs(row.weekendShare - 2 / 7) < 1e-12);
});

test('builder: weekend-only source has entropy < 1 and weekendShare = 1', () => {
  // Sun + Sat only
  const queue: QueueLine[] = [
    ql('2026-01-04T10:00:00Z', 'WK', 5000), // Sun
    ql('2026-01-10T10:00:00Z', 'WK', 5000), // Sat
  ];
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 0,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.weekendShare - 1) < 1e-12);
  assert.ok(row.normalizedEntropy < 1);
  assert.ok(row.normalizedEntropy > 0);
});

// ---- builder: filters / sort -----------------------------------------------

test('builder: minTokens filter surfaces droppedSparseSources', () => {
  const queue: QueueLine[] = [
    ql('2026-01-04T00:00:00Z', 'big', 100000),
    ql('2026-01-05T00:00:00Z', 'tiny', 5),
  ];
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 1000,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('builder: source filter restricts and surfaces dropped count', () => {
  const queue: QueueLine[] = [
    ql('2026-01-04T00:00:00Z', 'A', 5000),
    ql('2026-01-05T00:00:00Z', 'B', 5000),
  ];
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 0,
    source: 'A',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
  assert.equal(r.droppedSourceFilter, 1);
});

test('builder: invalid hour_start surfaces droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [
    ql('not-a-time', 'A', 1000),
    ql('2026-01-04T00:00:00Z', 'A', 1000),
  ];
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalTokens, 1000);
});

test('builder: non-positive tokens are dropped', () => {
  const queue: QueueLine[] = [
    { ...ql('2026-01-04T00:00:00Z', 'A', 0), total_tokens: 0 },
    { ...ql('2026-01-04T00:00:00Z', 'A', -5), total_tokens: -5 },
    ql('2026-01-04T01:00:00Z', 'A', 1000),
  ];
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources[0]!.totalTokens, 1000);
});

test('builder: top cap drops overflow into droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const s of ['A', 'B', 'C', 'D']) {
    queue.push(ql('2026-01-04T00:00:00Z', s, 5000));
  }
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 0,
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('builder: sort=weekend puts weekend-skewed source first', () => {
  const queue: QueueLine[] = [
    // Weekday-only source
    ql('2026-01-05T00:00:00Z', 'WD', 10000), // Mon
    ql('2026-01-06T00:00:00Z', 'WD', 10000), // Tue
    // Weekend-only source
    ql('2026-01-04T00:00:00Z', 'WE', 5000), // Sun
    ql('2026-01-10T00:00:00Z', 'WE', 5000), // Sat
  ];
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 0,
    sort: 'weekend',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'WE');
  assert.equal(r.sources[1]!.source, 'WD');
});

test('builder: sort=entropy puts most-concentrated source first', () => {
  const queue: QueueLine[] = [];
  // Uniform across 7 days
  for (const d of [
    '2026-01-04',
    '2026-01-05',
    '2026-01-06',
    '2026-01-07',
    '2026-01-08',
    '2026-01-09',
    '2026-01-10',
  ]) {
    queue.push(ql(`${d}T00:00:00Z`, 'UNI', 1000));
  }
  // All on one weekday
  queue.push(ql('2026-01-05T00:00:00Z', 'CONC', 100000));
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 0,
    sort: 'entropy',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'CONC');
  assert.equal(r.sources[1]!.source, 'UNI');
});

test('builder: minWeekendShare refinement filter drops weekday-skewed sources', () => {
  const queue: QueueLine[] = [
    ql('2026-01-05T00:00:00Z', 'WD', 10000), // Mon
    ql('2026-01-04T00:00:00Z', 'WE', 5000), // Sun
    ql('2026-01-10T00:00:00Z', 'WE', 5000), // Sat
  ];
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 0,
    minWeekendShare: 0.5,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'WE');
  assert.equal(r.droppedBelowMinWeekendShare, 1);
  assert.equal(r.minWeekendShare, 0.5);
});

test('builder: since/until window filter applies', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'A', 10000), // before window
    ql('2026-01-05T00:00:00Z', 'A', 5000),
    ql('2026-01-20T00:00:00Z', 'A', 7000), // after window
  ];
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 0,
    since: '2026-01-04T00:00:00Z',
    until: '2026-01-10T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalTokens, 5000);
});

test('builder: deterministic ordering on tie (source asc)', () => {
  const queue: QueueLine[] = [
    ql('2026-01-05T00:00:00Z', 'B', 5000),
    ql('2026-01-05T00:00:00Z', 'A', 5000),
    ql('2026-01-05T00:00:00Z', 'C', 5000),
  ];
  const r = buildSourceDayOfWeekTokenMassShare(queue, {
    minTokens: 0,
    sort: 'tokens',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['A', 'B', 'C'],
  );
});
