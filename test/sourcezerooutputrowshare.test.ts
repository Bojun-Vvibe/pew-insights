import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceZeroOutputRowShare } from '../src/sourcezerooutputrowshare.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  input_tokens: number,
  output_tokens = 10,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens,
    cached_input_tokens: 0,
    output_tokens,
    reasoning_output_tokens: 0,
    total_tokens: input_tokens + output_tokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

test('source-zero-output-row-share: empty input -> empty report with defaults', () => {
  const r = buildSourceZeroOutputRowShare([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRows, 0);
  assert.equal(r.totalZeroRows, 0);
  assert.equal(r.totalInputTokens, 0);
  assert.equal(r.totalZeroInputTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 3);
  assert.equal(r.minZeroShare, 0);
  assert.equal(r.minZeroInputShare, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'zero-share');
});

test('source-zero-output-row-share: rejects bad minRows', () => {
  assert.throws(() => buildSourceZeroOutputRowShare([], { minRows: 0 }));
  assert.throws(() => buildSourceZeroOutputRowShare([], { minRows: -1 }));
  assert.throws(() => buildSourceZeroOutputRowShare([], { minRows: 1.5 }));
});

test('source-zero-output-row-share: rejects bad minZeroShare', () => {
  assert.throws(() =>
    buildSourceZeroOutputRowShare([], { minZeroShare: -0.01 }),
  );
  assert.throws(() =>
    buildSourceZeroOutputRowShare([], { minZeroShare: 1.01 }),
  );
  assert.throws(() =>
    buildSourceZeroOutputRowShare([], { minZeroShare: Number.NaN }),
  );
});

test('source-zero-output-row-share: rejects bad minZeroInputShare', () => {
  assert.throws(() =>
    buildSourceZeroOutputRowShare([], { minZeroInputShare: -0.01 }),
  );
  assert.throws(() =>
    buildSourceZeroOutputRowShare([], { minZeroInputShare: 2 }),
  );
});

test('source-zero-output-row-share: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceZeroOutputRowShare([], {
      // @ts-expect-error invalid sort key
      sort: 'bogus',
    }),
  );
});

test('source-zero-output-row-share: rejects bad top', () => {
  assert.throws(() => buildSourceZeroOutputRowShare([], { top: 0 }));
  assert.throws(() => buildSourceZeroOutputRowShare([], { top: 1.5 }));
});

test('source-zero-output-row-share: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceZeroOutputRowShare([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceZeroOutputRowShare([], { until: 'not-a-date' }),
  );
});

test('source-zero-output-row-share: counts zero-output rows by source', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 100, 0),
    ql('2026-04-20T01:00:00Z', 'a', 200, 50),
    ql('2026-04-20T02:00:00Z', 'a', 300, 0),
    ql('2026-04-20T03:00:00Z', 'a', 400, 999),
    ql('2026-04-20T00:00:00Z', 'b', 10, 5),
    ql('2026-04-20T01:00:00Z', 'b', 20, 5),
    ql('2026-04-20T02:00:00Z', 'b', 30, 5),
  ];
  const r = buildSourceZeroOutputRowShare(q, { generatedAt: GEN, minRows: 3 });
  const a = r.sources.find((s) => s.source === 'a')!;
  const b = r.sources.find((s) => s.source === 'b')!;
  assert.equal(a.rows, 4);
  assert.equal(a.zeroRows, 2);
  assert.equal(a.zeroShare, 0.5);
  assert.equal(b.rows, 3);
  assert.equal(b.zeroRows, 0);
  assert.equal(b.zeroShare, 0);
});

test('source-zero-output-row-share: zeroInputShare reflects input tokens of zero-output rows only', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 100, 0), // zero-output, 100 in
    ql('2026-04-20T01:00:00Z', 'a', 50, 5), // non-zero
    ql('2026-04-20T02:00:00Z', 'a', 50, 0), // zero-output, 50 in
  ];
  const r = buildSourceZeroOutputRowShare(q, { generatedAt: GEN });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.zeroInputSum, 150);
  assert.equal(a.totalInputSum, 200);
  assert.equal(a.zeroInputShare, 0.75);
});

test('source-zero-output-row-share: zeroOnly true when every row is zero-output', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 1, 0),
    ql('2026-04-20T01:00:00Z', 'a', 2, 0),
    ql('2026-04-20T02:00:00Z', 'a', 3, 0),
  ];
  const r = buildSourceZeroOutputRowShare(q, { generatedAt: GEN });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.zeroOnly, true);
  assert.equal(a.zeroShare, 1);
});

test('source-zero-output-row-share: negative output_tokens treated as zero', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 100, -5),
    ql('2026-04-20T01:00:00Z', 'a', 100, 5),
    ql('2026-04-20T02:00:00Z', 'a', 100, 5),
  ];
  const r = buildSourceZeroOutputRowShare(q, { generatedAt: GEN });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.zeroRows, 1);
});

test('source-zero-output-row-share: non-finite output_tokens treated as zero', () => {
  const q: QueueLine[] = [
    {
      source: 'a',
      model: 'm',
      hour_start: '2026-04-20T00:00:00Z',
      device_id: 'd',
      input_tokens: 100,
      cached_input_tokens: 0,
      output_tokens: Number.NaN as unknown as number,
      reasoning_output_tokens: 0,
      total_tokens: 100,
    },
    ql('2026-04-20T01:00:00Z', 'a', 100, 5),
    ql('2026-04-20T02:00:00Z', 'a', 100, 5),
  ];
  const r = buildSourceZeroOutputRowShare(q, { generatedAt: GEN });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.zeroRows, 1);
});

test('source-zero-output-row-share: drops invalid hour_start', () => {
  const q = [
    ql('not-a-date', 'a', 100, 0),
    ql('2026-04-20T00:00:00Z', 'a', 100, 0),
    ql('2026-04-20T01:00:00Z', 'a', 100, 5),
    ql('2026-04-20T02:00:00Z', 'a', 100, 5),
  ];
  const r = buildSourceZeroOutputRowShare(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.rows, 3);
});

test('source-zero-output-row-share: window since/until inclusive/exclusive', () => {
  const q = [
    ql('2026-04-19T23:59:59Z', 'a', 1, 0),
    ql('2026-04-20T00:00:00Z', 'a', 1, 0),
    ql('2026-04-20T12:00:00Z', 'a', 1, 5),
    ql('2026-04-21T00:00:00Z', 'a', 1, 0),
  ];
  const r = buildSourceZeroOutputRowShare(q, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-21T00:00:00Z',
    minRows: 1,
  });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.rows, 2);
  assert.equal(a.zeroRows, 1);
});

test('source-zero-output-row-share: source filter narrows result', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 1, 0),
    ql('2026-04-20T01:00:00Z', 'a', 1, 0),
    ql('2026-04-20T02:00:00Z', 'a', 1, 5),
    ql('2026-04-20T00:00:00Z', 'b', 1, 5),
  ];
  const r = buildSourceZeroOutputRowShare(q, {
    generatedAt: GEN,
    source: 'a',
    minRows: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 1);
});

test('source-zero-output-row-share: empty source string -> "unknown"', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', '', 1, 0),
    ql('2026-04-20T01:00:00Z', '', 1, 0),
    ql('2026-04-20T02:00:00Z', '', 1, 5),
  ];
  const r = buildSourceZeroOutputRowShare(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('source-zero-output-row-share: min-rows filter', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 1, 0),
    ql('2026-04-20T01:00:00Z', 'a', 1, 0),
    ql('2026-04-20T00:00:00Z', 'b', 1, 0),
    ql('2026-04-20T01:00:00Z', 'b', 1, 0),
    ql('2026-04-20T02:00:00Z', 'b', 1, 5),
  ];
  const r = buildSourceZeroOutputRowShare(q, {
    generatedAt: GEN,
    minRows: 3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('source-zero-output-row-share: min-zero-share filter', () => {
  const q = [
    // a: zeroShare 1.0
    ql('2026-04-20T00:00:00Z', 'a', 1, 0),
    ql('2026-04-20T01:00:00Z', 'a', 1, 0),
    ql('2026-04-20T02:00:00Z', 'a', 1, 0),
    // b: zeroShare 0.333
    ql('2026-04-20T00:00:00Z', 'b', 1, 0),
    ql('2026-04-20T01:00:00Z', 'b', 1, 5),
    ql('2026-04-20T02:00:00Z', 'b', 1, 5),
  ];
  const r = buildSourceZeroOutputRowShare(q, {
    generatedAt: GEN,
    minZeroShare: 0.5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinZeroShare, 1);
});

test('source-zero-output-row-share: min-zero-input-share filter', () => {
  const q = [
    // a: zero-rows have 0 input -> zeroInputShare 0
    ql('2026-04-20T00:00:00Z', 'a', 0, 0),
    ql('2026-04-20T01:00:00Z', 'a', 0, 0),
    ql('2026-04-20T02:00:00Z', 'a', 100, 5),
    // b: zero-rows have all the input -> zeroInputShare 1
    ql('2026-04-20T00:00:00Z', 'b', 100, 0),
    ql('2026-04-20T01:00:00Z', 'b', 100, 0),
    ql('2026-04-20T02:00:00Z', 'b', 0, 5),
  ];
  const r = buildSourceZeroOutputRowShare(q, {
    generatedAt: GEN,
    minZeroInputShare: 0.5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinZeroInputShare, 1);
});

test('source-zero-output-row-share: sort by zero-share desc', () => {
  const q = [
    // a: 1/3 zero
    ql('2026-04-20T00:00:00Z', 'a', 1, 0),
    ql('2026-04-20T01:00:00Z', 'a', 1, 5),
    ql('2026-04-20T02:00:00Z', 'a', 1, 5),
    // b: 2/3 zero
    ql('2026-04-20T00:00:00Z', 'b', 1, 0),
    ql('2026-04-20T01:00:00Z', 'b', 1, 0),
    ql('2026-04-20T02:00:00Z', 'b', 1, 5),
    // c: 0/3 zero
    ql('2026-04-20T00:00:00Z', 'c', 1, 5),
    ql('2026-04-20T01:00:00Z', 'c', 1, 5),
    ql('2026-04-20T02:00:00Z', 'c', 1, 5),
  ];
  const r = buildSourceZeroOutputRowShare(q, {
    generatedAt: GEN,
    sort: 'zero-share',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'a', 'c'],
  );
});

test('source-zero-output-row-share: sort by source asc', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'b', 1, 0),
    ql('2026-04-20T01:00:00Z', 'b', 1, 0),
    ql('2026-04-20T02:00:00Z', 'b', 1, 0),
    ql('2026-04-20T00:00:00Z', 'a', 1, 0),
    ql('2026-04-20T01:00:00Z', 'a', 1, 0),
    ql('2026-04-20T02:00:00Z', 'a', 1, 0),
  ];
  const r = buildSourceZeroOutputRowShare(q, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b'],
  );
});

test('source-zero-output-row-share: sort by zero-rows desc', () => {
  const q = [
    // a: 5 rows, 1 zero
    ql('2026-04-20T00:00:00Z', 'a', 1, 0),
    ql('2026-04-20T01:00:00Z', 'a', 1, 5),
    ql('2026-04-20T02:00:00Z', 'a', 1, 5),
    ql('2026-04-20T03:00:00Z', 'a', 1, 5),
    ql('2026-04-20T04:00:00Z', 'a', 1, 5),
    // b: 3 rows, 3 zero
    ql('2026-04-20T00:00:00Z', 'b', 1, 0),
    ql('2026-04-20T01:00:00Z', 'b', 1, 0),
    ql('2026-04-20T02:00:00Z', 'b', 1, 0),
  ];
  const r = buildSourceZeroOutputRowShare(q, {
    generatedAt: GEN,
    sort: 'zero-rows',
  });
  assert.equal(r.sources[0]!.source, 'b');
});

test('source-zero-output-row-share: top cap drops survivors', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 1, 0),
    ql('2026-04-20T01:00:00Z', 'a', 1, 0),
    ql('2026-04-20T02:00:00Z', 'a', 1, 0),
    ql('2026-04-20T00:00:00Z', 'b', 1, 0),
    ql('2026-04-20T01:00:00Z', 'b', 1, 0),
    ql('2026-04-20T02:00:00Z', 'b', 1, 0),
    ql('2026-04-20T00:00:00Z', 'c', 1, 0),
    ql('2026-04-20T01:00:00Z', 'c', 1, 0),
    ql('2026-04-20T02:00:00Z', 'c', 1, 0),
  ];
  const r = buildSourceZeroOutputRowShare(q, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('source-zero-output-row-share: tie on primary sort -> source asc', () => {
  const q = [
    // both have zeroShare 0.5
    ql('2026-04-20T00:00:00Z', 'b', 1, 0),
    ql('2026-04-20T01:00:00Z', 'b', 1, 5),
    ql('2026-04-20T02:00:00Z', 'b', 1, 0),
    ql('2026-04-20T03:00:00Z', 'b', 1, 5),
    ql('2026-04-20T00:00:00Z', 'a', 1, 0),
    ql('2026-04-20T01:00:00Z', 'a', 1, 5),
    ql('2026-04-20T02:00:00Z', 'a', 1, 0),
    ql('2026-04-20T03:00:00Z', 'a', 1, 5),
  ];
  const r = buildSourceZeroOutputRowShare(q, {
    generatedAt: GEN,
    sort: 'zero-share',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b'],
  );
});

test('source-zero-output-row-share: totals reflect kept rows', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 100, 0),
    ql('2026-04-20T01:00:00Z', 'a', 200, 5),
    ql('2026-04-20T02:00:00Z', 'a', 300, 0),
  ];
  const r = buildSourceZeroOutputRowShare(q, { generatedAt: GEN });
  assert.equal(r.totalRows, 3);
  assert.equal(r.totalZeroRows, 2);
  assert.equal(r.totalInputTokens, 600);
  assert.equal(r.totalZeroInputTokens, 400);
});

test('source-zero-output-row-share: source with all zero-input rows still counted', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 0, 0),
    ql('2026-04-20T01:00:00Z', 'a', 0, 0),
    ql('2026-04-20T02:00:00Z', 'a', 0, 0),
  ];
  const r = buildSourceZeroOutputRowShare(q, { generatedAt: GEN });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.rows, 3);
  assert.equal(a.zeroRows, 3);
  assert.equal(a.zeroShare, 1);
  assert.equal(a.totalInputSum, 0);
  // by convention zeroInputShare = 0 when totalInputSum == 0
  assert.equal(a.zeroInputShare, 0);
});

test('source-zero-output-row-share: deterministic with fixed generatedAt', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 1, 0),
    ql('2026-04-20T01:00:00Z', 'a', 1, 0),
    ql('2026-04-20T02:00:00Z', 'a', 1, 5),
  ];
  const r1 = buildSourceZeroOutputRowShare(q, { generatedAt: GEN });
  const r2 = buildSourceZeroOutputRowShare(q, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

test('source-zero-output-row-share: zeroShare exact arithmetic', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 7; i += 1) {
    q.push(ql(`2026-04-20T0${i}:00:00Z`, 'a', 10, 0));
  }
  for (let i = 0; i < 3; i += 1) {
    q.push(ql(`2026-04-20T1${i}:00:00Z`, 'a', 10, 5));
  }
  const r = buildSourceZeroOutputRowShare(q, { generatedAt: GEN });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.rows, 10);
  assert.equal(a.zeroRows, 7);
  assert.equal(a.zeroShare, 0.7);
});
