import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenMad } from '../src/sourcerowtokenmad.js';
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

test('row-token-mad: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenMad([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 2);
  assert.equal(r.minMedian, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'mad-desc');
  assert.equal(r.generatedAt, GEN);
});

test('row-token-mad: rejects bad minRows', () => {
  assert.throws(() => buildSourceRowTokenMad([], { minRows: 0 }));
  assert.throws(() => buildSourceRowTokenMad([], { minRows: 1 }));
  assert.throws(() => buildSourceRowTokenMad([], { minRows: 2.5 }));
});

test('row-token-mad: rejects bad minMedian', () => {
  assert.throws(() => buildSourceRowTokenMad([], { minMedian: -1 }));
  assert.throws(() =>
    buildSourceRowTokenMad([], { minMedian: Number.POSITIVE_INFINITY }),
  );
  assert.throws(() =>
    buildSourceRowTokenMad([], { minMedian: Number.NaN }),
  );
});

test('row-token-mad: rejects bad top', () => {
  assert.throws(() => buildSourceRowTokenMad([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenMad([], { top: -1 }));
  assert.throws(() => buildSourceRowTokenMad([], { top: 1.5 }));
});

test('row-token-mad: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceRowTokenMad([], { sort: 'wat' as never }),
  );
});

test('row-token-mad: rejects bad since/until', () => {
  assert.throws(() => buildSourceRowTokenMad([], { since: 'not-a-date' }));
  assert.throws(() => buildSourceRowTokenMad([], { until: 'not-a-date' }));
});

test('row-token-mad: single-row source dropped (need >=2)', () => {
  const q = [ql('2026-04-27T00:00:00.000Z', 'a', 100)];
  const r = buildSourceRowTokenMad(q, { generatedAt: GEN });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedTooFewRowsForMad, 1);
  assert.equal(r.sources.length, 0);
});

test('row-token-mad: all-equal rows -> mad=0, madRatio=0, degenerate=false (median>0)', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 100),
    ql('2026-04-27T02:00:00.000Z', 'a', 100),
  ];
  const r = buildSourceRowTokenMad(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'a');
  assert.equal(s.rowsKept, 3);
  assert.equal(s.median, 100);
  assert.equal(s.mad, 0);
  assert.equal(s.madScaled, 0);
  assert.equal(s.madRatio, 0);
  assert.equal(s.degenerate, false);
});

test('row-token-mad: all-zero rows -> degenerate=true, madRatio=0', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 0),
    ql('2026-04-27T01:00:00.000Z', 'a', 0),
    ql('2026-04-27T02:00:00.000Z', 'a', 0),
  ];
  const r = buildSourceRowTokenMad(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.median, 0);
  assert.equal(s.mad, 0);
  assert.equal(s.madRatio, 0);
  assert.equal(s.degenerate, true);
});

test('row-token-mad: textbook 5-element MAD', () => {
  // x = [1, 2, 3, 6, 9]; median = 3; |dev| = [2,1,0,3,6]; sorted=[0,1,2,3,6]; mad=2.
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 2),
    ql('2026-04-27T02:00:00.000Z', 'a', 3),
    ql('2026-04-27T03:00:00.000Z', 'a', 6),
    ql('2026-04-27T04:00:00.000Z', 'a', 9),
  ];
  const r = buildSourceRowTokenMad(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.median, 3);
  assert.equal(s.mad, 2);
  assert.ok(Math.abs(s.madScaled - 2 * 1.4826) < 1e-9);
  assert.ok(Math.abs(s.madRatio - 2 / 3) < 1e-9);
});

test('row-token-mad: even-n median uses average of two middles', () => {
  // x=[1,2,3,4]; median = (2+3)/2 = 2.5; |dev|=[1.5,0.5,0.5,1.5]; sorted=[0.5,0.5,1.5,1.5]; mad=(0.5+1.5)/2=1.0
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 2),
    ql('2026-04-27T02:00:00.000Z', 'a', 3),
    ql('2026-04-27T03:00:00.000Z', 'a', 4),
  ];
  const r = buildSourceRowTokenMad(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.median, 2.5);
  assert.equal(s.mad, 1);
});

test('row-token-mad: MAD is robust to outliers (vs CV)', () => {
  // 99 rows = 100, 1 row = 100000. median = 100; |dev| has 99 zeros + 1*99900;
  // sorted -> middle = 0; mad = 0.  (Stddev would be huge.)
  const q: QueueLine[] = [];
  for (let i = 0; i < 99; i += 1) {
    q.push(ql(`2026-04-27T${String(i % 24).padStart(2, '0')}:00:00.000Z`, 'a', 100));
  }
  q.push(ql('2026-04-27T23:00:00.000Z', 'a', 100000));
  const r = buildSourceRowTokenMad(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.median, 100);
  assert.equal(s.mad, 0);
  assert.equal(s.madRatio, 0);
});

test('row-token-mad: clamps negative/non-finite total_tokens to 0', () => {
  const q: QueueLine[] = [
    { ...ql('2026-04-27T00:00:00.000Z', 'a', 0), total_tokens: -5 as unknown as number },
    { ...ql('2026-04-27T01:00:00.000Z', 'a', 0), total_tokens: Number.NaN as unknown as number },
    ql('2026-04-27T02:00:00.000Z', 'a', 4),
  ];
  const r = buildSourceRowTokenMad(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  // values become [0, 0, 4]; median=0; |dev|=[0,0,4]; mad=0
  assert.equal(s.median, 0);
  assert.equal(s.mad, 0);
  assert.equal(s.degenerate, true);
});

test('row-token-mad: invalid hour_start counted', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'a', 1),
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 1),
  ];
  const r = buildSourceRowTokenMad(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalRowsKept, 2);
});

test('row-token-mad: source filter accounted', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 2),
    ql('2026-04-27T02:00:00.000Z', 'b', 5),
  ];
  const r = buildSourceRowTokenMad(q, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('row-token-mad: window since/until exclusive upper', () => {
  const q = [
    ql('2026-04-26T23:59:59.999Z', 'a', 1),
    ql('2026-04-27T00:00:00.000Z', 'a', 2),
    ql('2026-04-27T01:00:00.000Z', 'a', 3),
    ql('2026-04-28T00:00:00.000Z', 'a', 4),
  ];
  const r = buildSourceRowTokenMad(q, {
    generatedAt: GEN,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
  });
  assert.equal(r.totalRowsKept, 2);
  const s = r.sources[0]!;
  assert.equal(s.median, 2.5);
});

test('row-token-mad: minRows display gate', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 2),
    ql('2026-04-27T00:00:00.000Z', 'b', 1),
    ql('2026-04-27T01:00:00.000Z', 'b', 2),
    ql('2026-04-27T02:00:00.000Z', 'b', 3),
  ];
  const r = buildSourceRowTokenMad(q, { generatedAt: GEN, minRows: 3 });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

test('row-token-mad: minMedian display gate (strict <)', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 1),
    ql('2026-04-27T00:00:00.000Z', 'b', 100),
    ql('2026-04-27T01:00:00.000Z', 'b', 100),
  ];
  // medians: a=1, b=100. min-median=50 drops a, keeps b.
  const r = buildSourceRowTokenMad(q, { generatedAt: GEN, minMedian: 50 });
  assert.equal(r.droppedBelowMinMedian, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  // strict-< : min-median = 100 should KEEP b (median = 100 not < 100)
  const r2 = buildSourceRowTokenMad(q, { generatedAt: GEN, minMedian: 100 });
  assert.equal(r2.sources.length, 1);
  assert.equal(r2.sources[0]!.source, 'b');
});

test('row-token-mad: top cap', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 100),
    ql('2026-04-27T00:00:00.000Z', 'b', 5),
    ql('2026-04-27T01:00:00.000Z', 'b', 5),
    ql('2026-04-27T00:00:00.000Z', 'c', 1),
    ql('2026-04-27T01:00:00.000Z', 'c', 50),
  ];
  // mad: a=49.5, b=0, c=24.5. top=2 keeps a,c.
  const r = buildSourceRowTokenMad(q, { generatedAt: GEN, top: 2 });
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'c');
});

test('row-token-mad: sort modes', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 100),
    ql('2026-04-27T00:00:00.000Z', 'b', 5),
    ql('2026-04-27T01:00:00.000Z', 'b', 5),
  ];
  // a: median=50.5, mad=49.5, ratio=49.5/50.5
  // b: median=5, mad=0, ratio=0
  const desc = buildSourceRowTokenMad(q, { generatedAt: GEN, sort: 'mad-desc' });
  assert.equal(desc.sources[0]!.source, 'a');
  const asc = buildSourceRowTokenMad(q, { generatedAt: GEN, sort: 'mad-asc' });
  assert.equal(asc.sources[0]!.source, 'b');
  const rdesc = buildSourceRowTokenMad(q, {
    generatedAt: GEN,
    sort: 'ratio-desc',
  });
  assert.equal(rdesc.sources[0]!.source, 'a');
  const rasc = buildSourceRowTokenMad(q, { generatedAt: GEN, sort: 'ratio-asc' });
  assert.equal(rasc.sources[0]!.source, 'b');
  const med = buildSourceRowTokenMad(q, { generatedAt: GEN, sort: 'median' });
  assert.equal(med.sources[0]!.source, 'a');
  const rows = buildSourceRowTokenMad(q, { generatedAt: GEN, sort: 'rows' });
  // both have 2 rows, tiebreak source asc
  assert.equal(rows.sources[0]!.source, 'a');
  const src = buildSourceRowTokenMad(q, { generatedAt: GEN, sort: 'source' });
  assert.equal(src.sources[0]!.source, 'a');
});

test('row-token-mad: deterministic generatedAt override', () => {
  const r = buildSourceRowTokenMad([], { generatedAt: GEN });
  assert.equal(r.generatedAt, GEN);
});

test('row-token-mad: empty source string -> "unknown"', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', '', 1),
    ql('2026-04-27T01:00:00.000Z', '', 2),
  ];
  const r = buildSourceRowTokenMad(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('row-token-mad: rejects bad minMadRatio', () => {
  assert.throws(() => buildSourceRowTokenMad([], { minMadRatio: -1 }));
  assert.throws(() =>
    buildSourceRowTokenMad([], { minMadRatio: Number.POSITIVE_INFINITY }),
  );
  assert.throws(() => buildSourceRowTokenMad([], { minMadRatio: Number.NaN }));
});

test('row-token-mad: minMadRatio gate (strict <)', () => {
  // a: x=[1,1,1,1] -> median=1, mad=0, ratio=0
  // b: x=[1,2,3,4] -> median=2.5, mad=1, ratio=0.4
  // c: x=[10,10,90,90] -> median=50, mad=40, ratio=0.8
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 1),
    ql('2026-04-27T02:00:00.000Z', 'a', 1),
    ql('2026-04-27T03:00:00.000Z', 'a', 1),
    ql('2026-04-27T00:00:00.000Z', 'b', 1),
    ql('2026-04-27T01:00:00.000Z', 'b', 2),
    ql('2026-04-27T02:00:00.000Z', 'b', 3),
    ql('2026-04-27T03:00:00.000Z', 'b', 4),
    ql('2026-04-27T00:00:00.000Z', 'c', 10),
    ql('2026-04-27T01:00:00.000Z', 'c', 10),
    ql('2026-04-27T02:00:00.000Z', 'c', 90),
    ql('2026-04-27T03:00:00.000Z', 'c', 90),
  ];
  // default 0 keeps all 3
  const r0 = buildSourceRowTokenMad(q, { generatedAt: GEN });
  assert.equal(r0.sources.length, 3);
  // 0.5 drops a (0) and b (0.4), keeps c (0.8)
  const r5 = buildSourceRowTokenMad(q, {
    generatedAt: GEN,
    minMadRatio: 0.5,
  });
  assert.equal(r5.droppedBelowMinMadRatio, 2);
  assert.equal(r5.sources.length, 1);
  assert.equal(r5.sources[0]!.source, 'c');
  // strict-< : exactly 0.4 drops a (0 < 0.4), keeps b (0.4 NOT < 0.4) and c
  const r4 = buildSourceRowTokenMad(q, {
    generatedAt: GEN,
    minMadRatio: 0.4,
  });
  assert.equal(r4.droppedBelowMinMadRatio, 1);
  assert.equal(r4.sources.length, 2);
  // 0.0001 drops only the exactly-zero a
  const rEps = buildSourceRowTokenMad(q, {
    generatedAt: GEN,
    minMadRatio: 0.0001,
  });
  assert.equal(rEps.droppedBelowMinMadRatio, 1);
  assert.equal(rEps.sources.length, 2);
});

test('row-token-mad: report exposes minMadRatio in header fields', () => {
  const r = buildSourceRowTokenMad([], {
    generatedAt: GEN,
    minMadRatio: 0.7,
  });
  assert.equal(r.minMadRatio, 0.7);
  assert.equal(r.droppedBelowMinMadRatio, 0);
});
