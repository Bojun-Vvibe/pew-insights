import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourcePeakHourOfDayArgmax } from '../src/sourcepeakhourofdayargmax.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens = 0,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

test('peak-hour-argmax: empty input -> empty report with defaults', () => {
  const r = buildSourcePeakHourOfDayArgmax([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 1);
  assert.equal(r.minMass, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'margin-desc');
  assert.equal(r.generatedAt, GEN);
});

test('peak-hour-argmax: rejects bad minRows', () => {
  assert.throws(() => buildSourcePeakHourOfDayArgmax([], { minRows: 0 }));
  assert.throws(() => buildSourcePeakHourOfDayArgmax([], { minRows: 1.5 }));
  assert.throws(() => buildSourcePeakHourOfDayArgmax([], { minRows: -1 }));
});

test('peak-hour-argmax: rejects bad minMass', () => {
  assert.throws(() => buildSourcePeakHourOfDayArgmax([], { minMass: -1 }));
  assert.throws(() =>
    buildSourcePeakHourOfDayArgmax([], { minMass: Number.NaN }),
  );
  assert.throws(() =>
    buildSourcePeakHourOfDayArgmax([], { minMass: Number.POSITIVE_INFINITY }),
  );
});

test('peak-hour-argmax: rejects bad top', () => {
  assert.throws(() => buildSourcePeakHourOfDayArgmax([], { top: 0 }));
  assert.throws(() => buildSourcePeakHourOfDayArgmax([], { top: 1.5 }));
});

test('peak-hour-argmax: rejects bad sort', () => {
  assert.throws(() =>
    // @ts-expect-error invalid sort
    buildSourcePeakHourOfDayArgmax([], { sort: 'bogus' }),
  );
});

test('peak-hour-argmax: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourcePeakHourOfDayArgmax([], { since: 'bad-date' }),
  );
  assert.throws(() =>
    buildSourcePeakHourOfDayArgmax([], { until: 'bad-date' }),
  );
});

test('peak-hour-argmax: single hour spike -> margin = 1.0', () => {
  // All mass at 17:00.
  const q: QueueLine[] = [
    ql('2026-04-20T17:00:00Z', 'a', 100),
    ql('2026-04-21T17:00:00Z', 'a', 200),
    ql('2026-04-22T17:00:00Z', 'a', 300),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.peakHour, 17);
  assert.equal(row.peakMass, 600);
  assert.equal(row.peakShare, 1);
  assert.equal(row.secondHour, null);
  assert.equal(row.secondShare, 0);
  assert.equal(row.margin, 1);
  assert.equal(row.hoursActive, 1);
});

test('peak-hour-argmax: two hours equal -> margin = 0', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T08:00:00Z', 'a', 100),
    ql('2026-04-20T16:00:00Z', 'a', 100),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  // tiebreak: lowest hour wins for argmax -> peakHour = 8.
  assert.equal(row.peakHour, 8);
  assert.equal(row.secondHour, 16);
  assert.equal(row.peakShare, 0.5);
  assert.equal(row.secondShare, 0.5);
  assert.equal(row.margin, 0);
  assert.equal(row.hoursActive, 2);
});

test('peak-hour-argmax: argmax tiebreak picks lowest hour', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T23:00:00Z', 'a', 500),
    ql('2026-04-20T01:00:00Z', 'a', 500),
    ql('2026-04-20T12:00:00Z', 'a', 100),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  // 1 and 23 both have 500; lowest wins -> 1.
  assert.equal(row.peakHour, 1);
  assert.equal(row.secondHour, 23);
});

test('peak-hour-argmax: clear peak with weaker echo -> moderate margin', () => {
  // 700 at 14, 200 at 09, 100 spread across other hours.
  const q: QueueLine[] = [
    ql('2026-04-20T14:00:00Z', 'a', 700),
    ql('2026-04-20T09:00:00Z', 'a', 200),
    ql('2026-04-20T18:00:00Z', 'a', 50),
    ql('2026-04-20T20:00:00Z', 'a', 50),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.peakHour, 14);
  assert.equal(row.secondHour, 9);
  assert.equal(row.totalMass, 1000);
  assert.equal(row.peakShare, 0.7);
  assert.equal(row.secondShare, 0.2);
  assert.ok(Math.abs(row.margin - 0.5) < 1e-9);
  assert.equal(row.hoursActive, 4);
});

test('peak-hour-argmax: drops non-positive total_tokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'a', 100),
    ql('2026-04-20T06:00:00Z', 'a', 0),
    ql('2026-04-20T07:00:00Z', 'a', -50),
    ql('2026-04-20T08:00:00Z', 'a', Number.NaN),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, { generatedAt: GEN });
  assert.equal(r.droppedNonPositiveTokens, 3);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.peakHour, 5);
  assert.equal(r.sources[0]!.peakMass, 100);
});

test('peak-hour-argmax: drops invalid hour_start', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql('2026-04-20T05:00:00Z', 'a', 100),
    ql('2026-04-20T06:00:00Z', 'a', 200),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalRowsKept, 2);
  assert.equal(r.sources[0]!.peakHour, 6);
});

test('peak-hour-argmax: --since/--until window gating', () => {
  const q: QueueLine[] = [
    ql('2026-04-19T03:00:00Z', 'a', 999), // pre
    ql('2026-04-20T05:00:00Z', 'a', 100),
    ql('2026-04-20T05:00:00Z', 'a', 200),
    ql('2026-04-21T00:00:00Z', 'a', 999), // post (until exclusive)
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, {
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-21T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.totalRowsKept, 2);
  assert.equal(r.sources[0]!.peakHour, 5);
  assert.equal(r.sources[0]!.peakMass, 300);
  assert.equal(r.windowStart, '2026-04-20T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-21T00:00:00Z');
});

test('peak-hour-argmax: --source restricts and counts dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'a', 100),
    ql('2026-04-20T05:00:00Z', 'b', 50),
    ql('2026-04-20T06:00:00Z', 'b', 50),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.source, 'a');
  assert.equal(r.totalRowsKept, 1);
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('peak-hour-argmax: missing/empty source -> "unknown"', () => {
  const q: QueueLine[] = [{ ...ql('2026-04-20T05:00:00Z', '', 100) }];
  const r = buildSourcePeakHourOfDayArgmax(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('peak-hour-argmax: --min-rows display gate', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'small', 100), // 1 row
    ql('2026-04-20T05:00:00Z', 'big', 100),
    ql('2026-04-20T06:00:00Z', 'big', 200),
    ql('2026-04-20T07:00:00Z', 'big', 300),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, {
    minRows: 3,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('peak-hour-argmax: --min-mass display gate', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'tiny', 5),
    ql('2026-04-20T05:00:00Z', 'big', 1000),
    ql('2026-04-20T06:00:00Z', 'big', 2000),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, {
    minMass: 100,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinMass, 1);
});

test('peak-hour-argmax: --top caps and counts dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'a', 100),
    ql('2026-04-20T05:00:00Z', 'b', 100),
    ql('2026-04-20T05:00:00Z', 'c', 100),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, { top: 2, generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.top, 2);
});

test('peak-hour-argmax: sort margin-desc default (sharpest peak first)', () => {
  // 'sharp' all at one hour (margin 1), 'flat' two equal hours (margin 0).
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'sharp', 100),
    ql('2026-04-20T05:00:00Z', 'sharp', 100),
    ql('2026-04-20T08:00:00Z', 'flat', 100),
    ql('2026-04-20T16:00:00Z', 'flat', 100),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'sharp');
  assert.equal(r.sources[1]!.source, 'flat');
  assert.equal(r.sources[0]!.margin, 1);
  assert.equal(r.sources[1]!.margin, 0);
});

test('peak-hour-argmax: sort margin-asc reverses', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'sharp', 100),
    ql('2026-04-20T08:00:00Z', 'flat', 100),
    ql('2026-04-20T16:00:00Z', 'flat', 100),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, {
    sort: 'margin-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'flat');
  assert.equal(r.sources[1]!.source, 'sharp');
});

test('peak-hour-argmax: sort peak-share desc', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'a', 100), // peakShare 1
    ql('2026-04-20T05:00:00Z', 'b', 100),
    ql('2026-04-20T06:00:00Z', 'b', 50), // peakShare 100/150 ~ 0.667
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, {
    sort: 'peak-share',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('peak-hour-argmax: sort peak-hour asc', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T22:00:00Z', 'late', 100),
    ql('2026-04-20T03:00:00Z', 'early', 100),
    ql('2026-04-20T12:00:00Z', 'noon', 100),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, {
    sort: 'peak-hour',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['early', 'noon', 'late'],
  );
});

test('peak-hour-argmax: sort mass desc', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'small', 10),
    ql('2026-04-20T05:00:00Z', 'big', 10000),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, {
    sort: 'mass',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.sources[1]!.source, 'small');
});

test('peak-hour-argmax: sort rows desc', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'a', 100),
    ql('2026-04-20T06:00:00Z', 'a', 100),
    ql('2026-04-20T07:00:00Z', 'a', 100),
    ql('2026-04-20T05:00:00Z', 'b', 1),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('peak-hour-argmax: sort source asc lex', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'gamma', 100),
    ql('2026-04-20T05:00:00Z', 'alpha', 100),
    ql('2026-04-20T05:00:00Z', 'beta', 100),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'beta', 'gamma'],
  );
});

test('peak-hour-argmax: tiebreak by source asc within same margin', () => {
  // Both sources have margin = 1.
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'z', 100),
    ql('2026-04-21T05:00:00Z', 'z', 100),
    ql('2026-04-20T17:00:00Z', 'a', 100),
    ql('2026-04-21T17:00:00Z', 'a', 100),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'z');
});

test('peak-hour-argmax: report carries all options/metadata', () => {
  const r = buildSourcePeakHourOfDayArgmax([], {
    minRows: 5,
    minMass: 100,
    top: 3,
    sort: 'peak-share',
    since: '2026-04-01T00:00:00Z',
    until: '2026-05-01T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.minRows, 5);
  assert.equal(r.minMass, 100);
  assert.equal(r.top, 3);
  assert.equal(r.sort, 'peak-share');
  assert.equal(r.windowStart, '2026-04-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00Z');
});

test('peak-hour-argmax: per-row hour aggregation across days', () => {
  // Hour 05: 100+200+300 = 600; hour 06: 50.
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'a', 100),
    ql('2026-04-21T05:00:00Z', 'a', 200),
    ql('2026-04-22T05:00:00Z', 'a', 300),
    ql('2026-04-20T06:00:00Z', 'a', 50),
  ];
  const r = buildSourcePeakHourOfDayArgmax(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.peakHour, 5);
  assert.equal(row.peakMass, 600);
  assert.equal(row.totalMass, 650);
  assert.equal(row.secondHour, 6);
  assert.equal(row.secondShare, 50 / 650);
});

test('peak-hour-argmax: JSON shape stability — keys present', () => {
  const q: QueueLine[] = [ql('2026-04-20T05:00:00Z', 'a', 100)];
  const r = buildSourcePeakHourOfDayArgmax(q, { generatedAt: GEN });
  for (const k of [
    'generatedAt',
    'windowStart',
    'windowEnd',
    'source',
    'minRows',
    'minMass',
    'top',
    'sort',
    'totalSources',
    'totalRowsKept',
    'droppedInvalidHourStart',
    'droppedNonPositiveTokens',
    'droppedSourceFilter',
    'droppedZeroMassSources',
    'droppedBelowMinRows',
    'droppedBelowMinMass',
    'droppedBelowTopCap',
    'sources',
  ]) {
    assert.ok(k in r, `missing key ${k}`);
  }
  const row = r.sources[0]!;
  for (const k of [
    'source',
    'rowsKept',
    'totalMass',
    'peakHour',
    'peakMass',
    'peakShare',
    'secondHour',
    'secondShare',
    'margin',
    'hoursActive',
  ]) {
    assert.ok(k in row, `missing row key ${k}`);
  }
});
