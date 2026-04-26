import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceDailyTokenTrendSlope,
  utcDayKey,
} from '../src/sourcedailytokentrendslope.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hourStart: string,
  source: string,
  totalTokens: number,
): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: totalTokens,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

test('utcDayKey: returns YYYY-MM-DD in UTC', () => {
  assert.equal(utcDayKey(Date.parse('2026-04-20T23:30:00.000Z')), '2026-04-20');
  assert.equal(utcDayKey(Date.parse('2026-04-20T00:00:00.000Z')), '2026-04-20');
  // 1970-01-02 epoch
  assert.equal(utcDayKey(Date.parse('1970-01-02T00:00:00.000Z')), '1970-01-02');
});

test('builder: empty queue -> zero sources, zero totals', () => {
  const r = buildSourceDailyTokenTrendSlope([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.sort, 'absslope');
  assert.equal(r.minActiveDays, 3);
});

test('builder: source with < minActiveDays drops as droppedBelowMinActiveDays', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'small', 100),
    ql('2026-04-21T10:00:00.000Z', 'small', 200),
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    minActiveDays: 3,
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedBelowMinActiveDays, 1);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('builder: clean linear up-trend -> positive slope, r2 = 1', () => {
  // y = 100, 200, 300, 400 over 4 consecutive days -> slope 100, intercept 100, r2 = 1
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 's', 100),
    ql('2026-04-21T05:00:00.000Z', 's', 200),
    ql('2026-04-22T05:00:00.000Z', 's', 300),
    ql('2026-04-23T05:00:00.000Z', 's', 400),
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    minActiveDays: 3,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 4);
  assert.equal(row.firstActiveDay, '2026-04-20');
  assert.equal(row.lastActiveDay, '2026-04-23');
  assert.equal(row.totalTokens, 1000);
  assert.equal(row.meanDailyTokens, 250);
  assert.equal(row.slopeTokensPerActiveDay, 100);
  assert.equal(row.interceptTokens, 100);
  assert.equal(row.normalizedSlope, 100 / 250);
  assert.ok(row.r2 !== null && Math.abs(row.r2 - 1) < 1e-12);
});

test('builder: clean linear down-trend -> negative slope, r2 = 1', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 's', 400),
    ql('2026-04-21T05:00:00.000Z', 's', 300),
    ql('2026-04-22T05:00:00.000Z', 's', 200),
    ql('2026-04-23T05:00:00.000Z', 's', 100),
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    minActiveDays: 3,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.slopeTokensPerActiveDay, -100);
  assert.equal(row.normalizedSlope, -100 / 250);
  assert.ok(row.r2 !== null && Math.abs(row.r2 - 1) < 1e-12);
});

test('builder: flat constant series -> slope=0, r2=null (variance=0)', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 's', 200),
    ql('2026-04-21T05:00:00.000Z', 's', 200),
    ql('2026-04-22T05:00:00.000Z', 's', 200),
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    minActiveDays: 3,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.slopeTokensPerActiveDay, 0);
  assert.equal(row.normalizedSlope, 0);
  assert.equal(row.r2, null);
  assert.equal(row.meanDailyTokens, 200);
});

test('builder: same UTC day rows aggregate before regression (n=3 from 6 rows)', () => {
  // Two rows per day, three days
  const q: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 's', 50),
    ql('2026-04-20T20:00:00.000Z', 's', 50), // day total 100
    ql('2026-04-21T01:00:00.000Z', 's', 100),
    ql('2026-04-21T20:00:00.000Z', 's', 100), // day total 200
    ql('2026-04-22T01:00:00.000Z', 's', 150),
    ql('2026-04-22T20:00:00.000Z', 's', 150), // day total 300
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    minActiveDays: 3,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 3);
  assert.equal(row.totalTokens, 600);
  assert.equal(row.meanDailyTokens, 200);
  assert.equal(row.slopeTokensPerActiveDay, 100); // 100, 200, 300
});

test('builder: inactive days are NOT inserted as zeroes (active-day-index, not wall clock)', () => {
  // 100, then 5-day gap, then 200, 300 -> indexed 0,1,2 not 0,5,6
  const q: QueueLine[] = [
    ql('2026-04-10T05:00:00.000Z', 's', 100),
    ql('2026-04-15T05:00:00.000Z', 's', 200),
    ql('2026-04-16T05:00:00.000Z', 's', 300),
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    minActiveDays: 3,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 3);
  // 100, 200, 300 -> slope 100, intercept 100, r2 = 1
  assert.equal(row.slopeTokensPerActiveDay, 100);
  assert.ok(row.r2 !== null && Math.abs(row.r2 - 1) < 1e-12);
});

test('builder: noisy series -> r2 strictly between 0 and 1', () => {
  // Slight upward trend with noise: 100, 250, 200, 400, 350
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 's', 100),
    ql('2026-04-21T05:00:00.000Z', 's', 250),
    ql('2026-04-22T05:00:00.000Z', 's', 200),
    ql('2026-04-23T05:00:00.000Z', 's', 400),
    ql('2026-04-24T05:00:00.000Z', 's', 350),
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    minActiveDays: 3,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(row.slopeTokensPerActiveDay > 0);
  assert.ok(row.r2 !== null && row.r2 > 0 && row.r2 < 1);
});

test('builder: bad hour_start counted; non-positive total_tokens counted', () => {
  const q: QueueLine[] = [
    { ...ql('not-a-date', 's', 100) },
    { ...ql('2026-04-20T10:00:00.000Z', 's', 0) },
    { ...ql('2026-04-20T10:00:00.000Z', 's', -5) },
  ];
  const r = buildSourceDailyTokenTrendSlope(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources.length, 0);
});

test('builder: source filter applied; non-matching surface as droppedSourceFilter', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'codex', 100),
    ql('2026-04-21T10:00:00.000Z', 'codex', 200),
    ql('2026-04-22T10:00:00.000Z', 'codex', 300),
    ql('2026-04-20T10:00:00.000Z', 'other', 999),
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    source: 'codex',
    generatedAt: GEN,
  });
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'codex');
  assert.equal(r.source, 'codex');
});

test('builder: since/until window filters by hour_start', () => {
  const q: QueueLine[] = [
    ql('2026-04-19T10:00:00.000Z', 's', 100), // before
    ql('2026-04-20T10:00:00.000Z', 's', 100),
    ql('2026-04-21T10:00:00.000Z', 's', 200),
    ql('2026-04-22T10:00:00.000Z', 's', 300),
    ql('2026-04-23T10:00:00.000Z', 's', 999), // at until -> excluded
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-23T10:00:00.000Z',
    minActiveDays: 3,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 3);
  assert.equal(row.totalTokens, 600);
});

test('builder: sort=absslope puts largest |slope| first; ties broken by source asc', () => {
  // A: slope +100; B: slope -50; C: slope +25
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'A', 100),
    ql('2026-04-21T05:00:00.000Z', 'A', 200),
    ql('2026-04-22T05:00:00.000Z', 'A', 300),
    ql('2026-04-20T05:00:00.000Z', 'B', 200),
    ql('2026-04-21T05:00:00.000Z', 'B', 150),
    ql('2026-04-22T05:00:00.000Z', 'B', 100),
    ql('2026-04-20T05:00:00.000Z', 'C', 100),
    ql('2026-04-21T05:00:00.000Z', 'C', 125),
    ql('2026-04-22T05:00:00.000Z', 'C', 150),
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    sort: 'absslope',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['A', 'B', 'C'],
  );
});

test('builder: sort=slope distinguishes sign (positive first, then negative)', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'A', 100),
    ql('2026-04-21T05:00:00.000Z', 'A', 200),
    ql('2026-04-22T05:00:00.000Z', 'A', 300),
    ql('2026-04-20T05:00:00.000Z', 'B', 300),
    ql('2026-04-21T05:00:00.000Z', 'B', 200),
    ql('2026-04-22T05:00:00.000Z', 'B', 100),
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    sort: 'slope',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'A');
  assert.equal(r.sources[1]!.source, 'B');
});

test('builder: sort=r2 puts highest r2 first; null r2 last', () => {
  // A: clean linear (r2 = 1)
  // B: flat (r2 = null)
  // C: noisy (r2 between 0 and 1)
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'A', 100),
    ql('2026-04-21T05:00:00.000Z', 'A', 200),
    ql('2026-04-22T05:00:00.000Z', 'A', 300),
    ql('2026-04-20T05:00:00.000Z', 'B', 200),
    ql('2026-04-21T05:00:00.000Z', 'B', 200),
    ql('2026-04-22T05:00:00.000Z', 'B', 200),
    ql('2026-04-20T05:00:00.000Z', 'C', 100),
    ql('2026-04-21T05:00:00.000Z', 'C', 350),
    ql('2026-04-22T05:00:00.000Z', 'C', 200),
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    sort: 'r2',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'A');
  // B is null-r2, sorts last
  assert.equal(r.sources[r.sources.length - 1]!.source, 'B');
});

test('builder: top cap applied after sort; remainder counted', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'A', 100),
    ql('2026-04-21T05:00:00.000Z', 'A', 200),
    ql('2026-04-22T05:00:00.000Z', 'A', 300),
    ql('2026-04-20T05:00:00.000Z', 'B', 100),
    ql('2026-04-21T05:00:00.000Z', 'B', 110),
    ql('2026-04-22T05:00:00.000Z', 'B', 120),
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    sort: 'absslope',
    top: 1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources[0]!.source, 'A');
});

test('builder: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceDailyTokenTrendSlope([], {
        sort: 'nope' as never,
        generatedAt: GEN,
      }),
    /sort must be one of/,
  );
});

test('builder: invalid since throws', () => {
  assert.throws(
    () =>
      buildSourceDailyTokenTrendSlope([], {
        since: 'definitely-not-a-date',
        generatedAt: GEN,
      }),
    /invalid since/,
  );
});

test('builder: minActiveDays < 2 throws', () => {
  assert.throws(
    () =>
      buildSourceDailyTokenTrendSlope([], {
        minActiveDays: 1,
        generatedAt: GEN,
      }),
    /minActiveDays must be/,
  );
});

test('builder: empty source string normalized to "(unknown)"', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', '', 100),
    ql('2026-04-21T05:00:00.000Z', '', 200),
    ql('2026-04-22T05:00:00.000Z', '', 300),
  ];
  const r = buildSourceDailyTokenTrendSlope(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('builder: top=0 means no cap (all rows kept)', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'A', 100),
    ql('2026-04-21T05:00:00.000Z', 'A', 200),
    ql('2026-04-22T05:00:00.000Z', 'A', 300),
    ql('2026-04-20T05:00:00.000Z', 'B', 100),
    ql('2026-04-21T05:00:00.000Z', 'B', 110),
    ql('2026-04-22T05:00:00.000Z', 'B', 120),
  ];
  const r = buildSourceDailyTokenTrendSlope(q, {
    top: 0,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 0);
});
