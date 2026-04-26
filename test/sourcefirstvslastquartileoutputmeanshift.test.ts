import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceFirstVsLastQuartileOutputMeanShift } from '../src/sourcefirstvslastquartileoutputmeanshift.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  output_tokens = 0,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens,
    reasoning_output_tokens: 0,
    total_tokens: output_tokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

test('first-vs-last-quartile: empty input -> empty report with defaults', () => {
  const r = buildSourceFirstVsLastQuartileOutputMeanShift([], {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'shift-desc');
  assert.equal(r.generatedAt, GEN);
});

test('first-vs-last-quartile: rejects bad minRows', () => {
  assert.throws(() =>
    buildSourceFirstVsLastQuartileOutputMeanShift([], { minRows: 0 }),
  );
  assert.throws(() =>
    buildSourceFirstVsLastQuartileOutputMeanShift([], { minRows: 3 }),
  );
  assert.throws(() =>
    buildSourceFirstVsLastQuartileOutputMeanShift([], { minRows: 4.5 }),
  );
});

test('first-vs-last-quartile: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceFirstVsLastQuartileOutputMeanShift([], {
      // @ts-expect-error invalid sort
      sort: 'bogus',
    }),
  );
});

test('first-vs-last-quartile: rejects bad top', () => {
  assert.throws(() =>
    buildSourceFirstVsLastQuartileOutputMeanShift([], { top: 0 }),
  );
  assert.throws(() =>
    buildSourceFirstVsLastQuartileOutputMeanShift([], { top: 1.5 }),
  );
});

test('first-vs-last-quartile: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceFirstVsLastQuartileOutputMeanShift([], { since: 'bad-date' }),
  );
  assert.throws(() =>
    buildSourceFirstVsLastQuartileOutputMeanShift([], { until: 'bad-date' }),
  );
});

test('first-vs-last-quartile: drops sources with rows < 4 as too-few', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 100),
    ql('2026-04-20T01:00:00Z', 'a', 200),
    ql('2026-04-20T02:00:00Z', 'a', 300),
  ];
  const r = buildSourceFirstVsLastQuartileOutputMeanShift(q, {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalRowsKept, 3);
  assert.equal(r.droppedTooFewRowsForQuartiles, 1);
  assert.equal(r.sources.length, 0);
});

test('first-vs-last-quartile: stationary source has zero shift', () => {
  // 8 rows all output=100 -> firstQ=lastQ=100, shift=0, relShift=0
  const q: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) {
    const h = String(i).padStart(2, '0');
    q.push(ql(`2026-04-20T${h}:00:00Z`, 'flat', 100));
  }
  const r = buildSourceFirstVsLastQuartileOutputMeanShift(q, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'flat');
  assert.equal(row.rowsKept, 8);
  assert.equal(row.firstQRows, 2);
  assert.equal(row.lastQRows, 2);
  assert.equal(row.firstQMean, 100);
  assert.equal(row.lastQMean, 100);
  assert.equal(row.meanShift, 0);
  assert.equal(row.relShift, 0);
  assert.equal(row.degenerate, false);
});

test('first-vs-last-quartile: growing source has positive shift', () => {
  // 8 rows: outputs 10,20,30,40,50,60,70,80 (chronological)
  // Q1 = [10,20] mean=15 ; Q4 = [70,80] mean=75 ; shift=60 ; rel=4
  const q: QueueLine[] = [];
  const outs = [10, 20, 30, 40, 50, 60, 70, 80];
  for (let i = 0; i < 8; i += 1) {
    const h = String(i).padStart(2, '0');
    q.push(ql(`2026-04-20T${h}:00:00Z`, 'grow', outs[i]!));
  }
  const r = buildSourceFirstVsLastQuartileOutputMeanShift(q, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.firstQMean, 15);
  assert.equal(row.lastQMean, 75);
  assert.equal(row.meanShift, 60);
  assert.equal(row.relShift, 4);
  assert.equal(row.degenerate, false);
  assert.equal(row.firstQEnd, '2026-04-20T01:00:00.000Z');
  assert.equal(row.lastQStart, '2026-04-20T06:00:00.000Z');
});

test('first-vs-last-quartile: shrinking source has negative shift', () => {
  const q: QueueLine[] = [];
  const outs = [80, 70, 60, 50, 40, 30, 20, 10];
  for (let i = 0; i < 8; i += 1) {
    const h = String(i).padStart(2, '0');
    q.push(ql(`2026-04-20T${h}:00:00Z`, 'shrink', outs[i]!));
  }
  const r = buildSourceFirstVsLastQuartileOutputMeanShift(q, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.firstQMean, 75);
  assert.equal(row.lastQMean, 15);
  assert.equal(row.meanShift, -60);
  assert.ok(Math.abs(row.relShift - -0.8) < 1e-9);
});

test('first-vs-last-quartile: degenerate when firstQMean is 0', () => {
  // Q1 outputs all 0, Q4 outputs positive
  const q: QueueLine[] = [];
  const outs = [0, 0, 50, 50, 50, 50, 100, 100];
  for (let i = 0; i < 8; i += 1) {
    const h = String(i).padStart(2, '0');
    q.push(ql(`2026-04-20T${h}:00:00Z`, 's', outs[i]!));
  }
  const r = buildSourceFirstVsLastQuartileOutputMeanShift(q, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.firstQMean, 0);
  assert.equal(row.lastQMean, 100);
  assert.equal(row.meanShift, 100);
  assert.equal(row.relShift, 0); // can't divide; reported as 0
  assert.equal(row.degenerate, true);
});

test('first-vs-last-quartile: rows are sorted chronologically before quartile split', () => {
  // Insert in shuffled order; result must match chronological growth
  const q: QueueLine[] = [
    ql('2026-04-20T07:00:00Z', 'g', 80),
    ql('2026-04-20T00:00:00Z', 'g', 10),
    ql('2026-04-20T05:00:00Z', 'g', 60),
    ql('2026-04-20T03:00:00Z', 'g', 40),
    ql('2026-04-20T01:00:00Z', 'g', 20),
    ql('2026-04-20T06:00:00Z', 'g', 70),
    ql('2026-04-20T02:00:00Z', 'g', 30),
    ql('2026-04-20T04:00:00Z', 'g', 50),
  ];
  const r = buildSourceFirstVsLastQuartileOutputMeanShift(q, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.firstQMean, 15);
  assert.equal(row.lastQMean, 75);
  assert.equal(row.meanShift, 60);
});

test('first-vs-last-quartile: quartile size = floor(n/4) for non-multiples of 4', () => {
  // 9 rows -> q = floor(9/4) = 2
  const q: QueueLine[] = [];
  const outs = [10, 20, 100, 100, 100, 100, 100, 70, 80];
  for (let i = 0; i < 9; i += 1) {
    const h = String(i).padStart(2, '0');
    q.push(ql(`2026-04-20T${h}:00:00Z`, 's', outs[i]!));
  }
  const r = buildSourceFirstVsLastQuartileOutputMeanShift(q, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.rowsKept, 9);
  assert.equal(row.firstQRows, 2);
  assert.equal(row.lastQRows, 2);
  assert.equal(row.firstQMean, 15); // (10+20)/2
  assert.equal(row.lastQMean, 75); // (70+80)/2
});

test('first-vs-last-quartile: window filter via since/until', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) {
    const h = String(i).padStart(2, '0');
    q.push(ql(`2026-04-20T${h}:00:00Z`, 's', 10 + i * 10));
  }
  // Add some rows outside the window that should be excluded
  q.push(ql('2026-04-19T00:00:00Z', 's', 9999));
  q.push(ql('2026-04-21T00:00:00Z', 's', 9999));
  const r = buildSourceFirstVsLastQuartileOutputMeanShift(q, {
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-21T00:00:00Z',
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.rowsKept, 8);
  assert.equal(row.firstQMean, 15);
  assert.equal(row.lastQMean, 75);
});

test('first-vs-last-quartile: source filter excludes other sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) {
    const h = String(i).padStart(2, '0');
    q.push(ql(`2026-04-20T${h}:00:00Z`, 'a', 10));
    q.push(ql(`2026-04-20T${h}:00:00Z`, 'b', 100));
  }
  const r = buildSourceFirstVsLastQuartileOutputMeanShift(q, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedSourceFilter, 8);
  assert.equal(r.sources[0]!.source, 'a');
});

test('first-vs-last-quartile: invalid hour_start counted as droppedInvalidHourStart', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql('also-bad', 'a', 200),
  ];
  for (let i = 0; i < 8; i += 1) {
    const h = String(i).padStart(2, '0');
    q.push(ql(`2026-04-20T${h}:00:00Z`, 'a', 50));
  }
  const r = buildSourceFirstVsLastQuartileOutputMeanShift(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 2);
  assert.equal(r.sources[0]!.rowsKept, 8);
});

test('first-vs-last-quartile: sort by abs-shift surfaces largest |drift| first', () => {
  // Source a: shift = +60 ; source b: shift = -120 ; source c: shift = +10
  function makeSource(name: string, outs: number[]) {
    return outs.map((v, i) =>
      ql(`2026-04-${20 + i}T00:00:00Z`, name, v),
    );
  }
  const q: QueueLine[] = [
    ...makeSource('a', [10, 20, 30, 40, 50, 60, 70, 80]), // shift +60
    ...makeSource('b', [200, 180, 160, 140, 120, 100, 80, 60]), // Q1=190 Q4=70 shift -120
    ...makeSource('c', [50, 50, 50, 55, 55, 55, 60, 60]), // Q1=50 Q4=60 shift +10
  ];
  const r = buildSourceFirstVsLastQuartileOutputMeanShift(q, {
    sort: 'abs-shift',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 3);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[1]!.source, 'a');
  assert.equal(r.sources[2]!.source, 'c');
});

test('first-vs-last-quartile: top cap reports droppedBelowTopCap', () => {
  function makeSource(name: string, outs: number[]) {
    return outs.map((v, i) =>
      ql(`2026-04-${20 + i}T00:00:00Z`, name, v),
    );
  }
  const q: QueueLine[] = [
    ...makeSource('a', [10, 20, 30, 40, 50, 60, 70, 80]),
    ...makeSource('b', [200, 180, 160, 140, 120, 100, 80, 60]),
    ...makeSource('c', [50, 50, 50, 55, 55, 55, 60, 60]),
  ];
  const r = buildSourceFirstVsLastQuartileOutputMeanShift(q, {
    sort: 'abs-shift',
    top: 1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowTopCap, 2);
});

test('first-vs-last-quartile: deterministic tiebreak by source asc', () => {
  function makeSource(name: string) {
    const out: QueueLine[] = [];
    for (let i = 0; i < 8; i += 1) {
      const h = String(i).padStart(2, '0');
      out.push(ql(`2026-04-20T${h}:00:00Z`, name, 100));
    }
    return out;
  }
  const q: QueueLine[] = [
    ...makeSource('zeta'),
    ...makeSource('alpha'),
    ...makeSource('mu'),
  ];
  const r = buildSourceFirstVsLastQuartileOutputMeanShift(q, {
    generatedAt: GEN,
  });
  // All have shift 0 -> tiebreak source asc
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mu', 'zeta'],
  );
});
