import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceTokenMassHourCentroid,
  circularHourCentroid,
  circularSpreadHours,
  angleToHour,
} from '../src/sourcetokenmasshourcentroid.js';
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

// ---- circular helpers -------------------------------------------------------

test('angleToHour: wraps negative and large angles', () => {
  assert.equal(angleToHour(0), 0);
  // pi rad = 12h
  assert.ok(Math.abs(angleToHour(Math.PI) - 12) < 1e-9);
  // -pi/2 rad = -6h -> 18h
  assert.ok(Math.abs(angleToHour(-Math.PI / 2) - 18) < 1e-9);
  // 4*pi (two full revs) -> 0
  assert.ok(Math.abs(angleToHour(4 * Math.PI)) < 1e-9);
});

test('circularHourCentroid: rejects wrong length', () => {
  assert.throws(() => circularHourCentroid(new Array(23).fill(0)));
  assert.throws(() => circularHourCentroid(new Array(25).fill(0)));
});

test('circularHourCentroid: zero mass returns origin', () => {
  const r = circularHourCentroid(new Array(24).fill(0));
  assert.equal(r.centroidHour, 0);
  assert.equal(r.resultantLength, 0);
});

test('circularHourCentroid: all mass at hour 6 -> centroid 6, R=1', () => {
  const m = new Array(24).fill(0);
  m[6] = 100;
  const r = circularHourCentroid(m);
  assert.ok(Math.abs(r.centroidHour - 6) < 1e-9);
  assert.ok(Math.abs(r.resultantLength - 1) < 1e-12);
});

test('circularHourCentroid: equal mass at 23 and 0 -> centroid near 23.5 (NOT 11.5)', () => {
  const m = new Array(24).fill(0);
  m[23] = 50;
  m[0] = 50;
  const r = circularHourCentroid(m);
  // Linear mean would be 11.5; circular mean must be near 23.5 (or 0 - 0.5).
  // angleToHour wraps so the answer is either ~23.5 or very close to 24/0.
  const distToMidnight = Math.min(
    Math.abs(r.centroidHour - 23.5),
    Math.abs(r.centroidHour - 0 + 0.5), // wrap-around equivalent
  );
  assert.ok(
    distToMidnight < 0.05,
    `expected centroid near 23.5, got ${r.centroidHour}`,
  );
  // R should be high but not exactly 1 (two-point distribution on 1h apart).
  assert.ok(r.resultantLength > 0.99);
});

test('circularHourCentroid: uniform mass -> R near 0', () => {
  const m = new Array(24).fill(10);
  const r = circularHourCentroid(m);
  assert.ok(r.resultantLength < 1e-12);
});

test('circularHourCentroid: ignores non-finite/non-positive mass', () => {
  const m = new Array(24).fill(0);
  m[12] = 100;
  m[3] = -5; // ignored
  m[7] = NaN; // ignored
  const r = circularHourCentroid(m);
  assert.ok(Math.abs(r.centroidHour - 12) < 1e-9);
  assert.ok(Math.abs(r.resultantLength - 1) < 1e-12);
});

test('circularSpreadHours: monotone in R', () => {
  assert.equal(circularSpreadHours(0), Infinity);
  assert.equal(circularSpreadHours(1), 0);
  const a = circularSpreadHours(0.9);
  const b = circularSpreadHours(0.5);
  const c = circularSpreadHours(0.1);
  assert.ok(a < b && b < c);
});

// ---- option validation -----------------------------------------------------

test('option validation: minTokens / top / sort / since / until / source', () => {
  assert.throws(() =>
    buildSourceTokenMassHourCentroid([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildSourceTokenMassHourCentroid([], { minTokens: NaN }),
  );
  assert.throws(() => buildSourceTokenMassHourCentroid([], { top: -1 }));
  assert.throws(() => buildSourceTokenMassHourCentroid([], { top: 1.5 }));
  assert.throws(() =>
    buildSourceTokenMassHourCentroid([], {
      sort: 'bogus' as 'tokens',
    }),
  );
  assert.throws(() =>
    buildSourceTokenMassHourCentroid([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceTokenMassHourCentroid([], { until: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceTokenMassHourCentroid([], {
      source: 5 as unknown as string,
    }),
  );
});

// ---- end-to-end -----------------------------------------------------------

test('builder: empty queue returns empty report with zero counters', () => {
  const r = buildSourceTokenMassHourCentroid([], { generatedAt: GEN });
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.droppedInvalidHourStart, 0);
  assert.equal(r.droppedNonPositiveTokens, 0);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.sort, 'tokens');
});

test('builder: single source, single hour -> centroid = that hour, R=1', () => {
  const queue = [
    ql('2026-04-20T14:00:00.000Z', 'srcA', 5000),
    ql('2026-04-21T14:00:00.000Z', 'srcA', 7000),
  ];
  const r = buildSourceTokenMassHourCentroid(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'srcA');
  assert.equal(s.totalTokens, 12000);
  assert.equal(s.nBuckets, 1);
  assert.equal(s.nDays, 2);
  assert.equal(s.firstDay, '2026-04-20');
  assert.equal(s.lastDay, '2026-04-21');
  assert.ok(Math.abs(s.centroidHour - 14) < 1e-9);
  assert.ok(Math.abs(s.resultantLength - 1) < 1e-12);
  assert.equal(s.spreadHours, 0);
  assert.equal(s.peakHour, 14);
  assert.equal(s.peakHourTokens, 12000);
});

test('builder: midnight straddler centroid does NOT collapse to noon', () => {
  // 50% of mass at 23:00, 50% at 00:00 across two days
  const queue = [
    ql('2026-04-20T23:00:00.000Z', 'night', 1000),
    ql('2026-04-21T00:00:00.000Z', 'night', 1000),
    // a daytime source for contrast
    ql('2026-04-20T12:00:00.000Z', 'day', 2000),
  ];
  const r = buildSourceTokenMassHourCentroid(queue, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 2);
  const night = r.sources.find((s) => s.source === 'night')!;
  const day = r.sources.find((s) => s.source === 'day')!;
  // night centroid should be on the seam, NOT 11.5
  const nightDist = Math.min(
    Math.abs(night.centroidHour - 23.5),
    Math.abs(night.centroidHour + 0.5),
    Math.abs(night.centroidHour - 23.5 + 24),
  );
  assert.ok(
    nightDist < 0.05,
    `night centroid should be near midnight seam, got ${night.centroidHour}`,
  );
  assert.ok(Math.abs(day.centroidHour - 12) < 1e-9);
  assert.ok(day.resultantLength > 0.99);
});

test('builder: minTokens drops sparse sources, surfaces dropped count', () => {
  const queue = [
    ql('2026-04-20T10:00:00.000Z', 'big', 5000),
    ql('2026-04-20T11:00:00.000Z', 'small', 100),
  ];
  const r = buildSourceTokenMassHourCentroid(queue, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.totalSources, 2);
});

test('builder: drops invalid hour_start and non-positive tokens', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 1000),
    ql('2026-04-20T10:00:00.000Z', 'a', 0),
    ql('2026-04-20T10:00:00.000Z', 'a', -50),
    ql('2026-04-20T10:00:00.000Z', 'a', NaN),
    ql('2026-04-20T10:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceTokenMassHourCentroid(queue, {
    generatedAt: GEN,
    minTokens: 1,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 3);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalTokens, 5000);
});

test('builder: source filter restricts and counts dropped', () => {
  const queue = [
    ql('2026-04-20T10:00:00.000Z', 'a', 5000),
    ql('2026-04-20T10:00:00.000Z', 'b', 5000),
    ql('2026-04-20T10:00:00.000Z', 'c', 5000),
  ];
  const r = buildSourceTokenMassHourCentroid(queue, {
    generatedAt: GEN,
    source: 'b',
    minTokens: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedSourceFilter, 2);
});

test('builder: since/until window filters', () => {
  const queue = [
    ql('2026-04-19T10:00:00.000Z', 'a', 5000),
    ql('2026-04-20T10:00:00.000Z', 'a', 5000),
    ql('2026-04-21T10:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceTokenMassHourCentroid(queue, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-21T00:00:00.000Z',
    minTokens: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalTokens, 5000);
});

test('builder: top cap applied after sort, surfaces droppedTopSources', () => {
  const queue = [
    ql('2026-04-20T10:00:00.000Z', 'big', 9000),
    ql('2026-04-20T10:00:00.000Z', 'mid', 5000),
    ql('2026-04-20T10:00:00.000Z', 'low', 2000),
  ];
  const r = buildSourceTokenMassHourCentroid(queue, {
    generatedAt: GEN,
    top: 2,
    sort: 'tokens',
    minTokens: 1,
  });
  assert.equal(r.sources.length, 2);
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['big', 'mid'],
  );
  assert.equal(r.droppedTopSources, 1);
});

test('builder: sort by centroid is ascending, ties by source asc', () => {
  const queue = [
    ql('2026-04-20T22:00:00.000Z', 'late', 5000),
    ql('2026-04-20T08:00:00.000Z', 'early', 5000),
    ql('2026-04-20T15:00:00.000Z', 'mid1', 5000),
    ql('2026-04-20T15:00:00.000Z', 'mid2', 5000),
  ];
  const r = buildSourceTokenMassHourCentroid(queue, {
    generatedAt: GEN,
    sort: 'centroid',
    minTokens: 1,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['early', 'mid1', 'mid2', 'late'],
  );
});

test('builder: sort by R puts most-concentrated source first', () => {
  // src 'tight': all 9000 tokens at one hour -> R=1
  // src 'loose': 2000 spread across 4 different hours -> R<<1
  const queue = [
    ql('2026-04-20T10:00:00.000Z', 'tight', 9000),
    ql('2026-04-20T01:00:00.000Z', 'loose', 500),
    ql('2026-04-20T07:00:00.000Z', 'loose', 500),
    ql('2026-04-20T13:00:00.000Z', 'loose', 500),
    ql('2026-04-20T19:00:00.000Z', 'loose', 500),
  ];
  const r = buildSourceTokenMassHourCentroid(queue, {
    generatedAt: GEN,
    sort: 'r',
    minTokens: 1,
  });
  assert.equal(r.sources[0]!.source, 'tight');
  assert.ok(r.sources[0]!.resultantLength > r.sources[1]!.resultantLength);
});

test('builder: empty/missing source string normalizes to (unknown)', () => {
  const queue = [
    ql('2026-04-20T10:00:00.000Z', '', 5000),
  ];
  const r = buildSourceTokenMassHourCentroid(queue, {
    generatedAt: GEN,
    minTokens: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('builder: sort=source is alphabetical by source asc', () => {
  const queue = [
    ql('2026-04-20T10:00:00.000Z', 'zebra', 5000),
    ql('2026-04-20T10:00:00.000Z', 'alpha', 5000),
    ql('2026-04-20T10:00:00.000Z', 'mango', 5000),
  ];
  const r = buildSourceTokenMassHourCentroid(queue, {
    generatedAt: GEN,
    sort: 'source',
    minTokens: 1,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mango', 'zebra'],
  );
});
