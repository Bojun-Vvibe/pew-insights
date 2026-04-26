import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenSkewness } from '../src/sourcerowtokenskewness.js';
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

test('row-token-skewness: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenSkewness([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 3);
  assert.equal(r.minMean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'skew-desc');
  assert.equal(r.generatedAt, GEN);
});

test('row-token-skewness: rejects bad minRows', () => {
  assert.throws(() => buildSourceRowTokenSkewness([], { minRows: 0 }));
  assert.throws(() => buildSourceRowTokenSkewness([], { minRows: 2 }));
  assert.throws(() => buildSourceRowTokenSkewness([], { minRows: 3.5 }));
});

test('row-token-skewness: rejects bad minMean', () => {
  assert.throws(() => buildSourceRowTokenSkewness([], { minMean: -1 }));
  assert.throws(() =>
    buildSourceRowTokenSkewness([], { minMean: Number.POSITIVE_INFINITY }),
  );
  assert.throws(() => buildSourceRowTokenSkewness([], { minMean: Number.NaN }));
});

test('row-token-skewness: rejects bad top', () => {
  assert.throws(() => buildSourceRowTokenSkewness([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenSkewness([], { top: 1.5 }));
});

test('row-token-skewness: rejects bad sort', () => {
  assert.throws(() =>
    // @ts-expect-error invalid sort
    buildSourceRowTokenSkewness([], { sort: 'bogus' }),
  );
});

test('row-token-skewness: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceRowTokenSkewness([], { since: 'bad-date' }),
  );
  assert.throws(() =>
    buildSourceRowTokenSkewness([], { until: 'bad-date' }),
  );
});

test('row-token-skewness: drops sources with rows < 3 as too-few', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 100),
    ql('2026-04-20T01:00:00Z', 'a', 200),
  ];
  const r = buildSourceRowTokenSkewness(q, { generatedAt: GEN });
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalRowsKept, 2);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedTooFewRowsForSkewness, 1);
});

test('row-token-skewness: counts invalid hour_start', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql('2026-04-20T00:00:00Z', 'a', 100),
    ql('2026-04-20T01:00:00Z', 'a', 200),
    ql('2026-04-20T02:00:00Z', 'a', 300),
  ];
  const r = buildSourceRowTokenSkewness(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalRowsKept, 3);
  assert.equal(r.sources.length, 1);
});

test('row-token-skewness: symmetric distribution -> skewness ~ 0', () => {
  // Symmetric around 100: {50, 100, 150}
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'sym', 50),
    ql('2026-04-20T01:00:00Z', 'sym', 100),
    ql('2026-04-20T02:00:00Z', 'sym', 150),
  ];
  const r = buildSourceRowTokenSkewness(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'sym');
  assert.equal(row.rowsKept, 3);
  assert.equal(row.mean, 100);
  // population variance of {50, 100, 150} = (2500 + 0 + 2500) / 3 = 1666.6...
  assert.ok(Math.abs(row.variance - 5000 / 3) < 1e-9);
  // m3 = (-50)^3 + 0 + 50^3 = 0; skewness = 0 exactly.
  assert.ok(Math.abs(row.skewness) < 1e-12);
  assert.equal(row.degenerate, false);
});

test('row-token-skewness: right-skewed sample -> positive skewness', () => {
  // Many small, one fat: {10, 10, 10, 10, 1000}
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'r', 10),
    ql('2026-04-20T01:00:00Z', 'r', 10),
    ql('2026-04-20T02:00:00Z', 'r', 10),
    ql('2026-04-20T03:00:00Z', 'r', 10),
    ql('2026-04-20T04:00:00Z', 'r', 1000),
  ];
  const r = buildSourceRowTokenSkewness(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.source, 'r');
  assert.equal(row.rowsKept, 5);
  assert.ok(row.skewness > 1, `expected skewness > 1, got ${row.skewness}`);
  assert.equal(row.degenerate, false);
  // Computed by hand: mean = 208, m2 = 4*(198^2) + 792^2 = 156816 + 627264
  //                  = 784080; var = 156816; stddev = ~395.998...
  // m3 = 4*(-198)^3 + 792^3 = -31049568 + 4.96766e8 = ~465716928
  // skewness = (m3/5) / stddev^3 = 93143385.6 / ~6.21e7 = ~1.5
  assert.ok(
    Math.abs(row.skewness - 1.5) < 0.01,
    `expected ~1.5, got ${row.skewness}`,
  );
});

test('row-token-skewness: left-skewed sample -> negative skewness', () => {
  // Many big, one small: mirror of right-skewed.
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'l', 1000),
    ql('2026-04-20T01:00:00Z', 'l', 1000),
    ql('2026-04-20T02:00:00Z', 'l', 1000),
    ql('2026-04-20T03:00:00Z', 'l', 1000),
    ql('2026-04-20T04:00:00Z', 'l', 10),
  ];
  const r = buildSourceRowTokenSkewness(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(row.skewness < -1, `expected skewness < -1, got ${row.skewness}`);
  // Symmetric to the right-skewed case in magnitude.
  assert.ok(Math.abs(row.skewness + 1.5) < 0.01);
});

test('row-token-skewness: all-zero rows -> degenerate flag, skewness 0', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'z', 0),
    ql('2026-04-20T01:00:00Z', 'z', 0),
    ql('2026-04-20T02:00:00Z', 'z', 0),
  ];
  const r = buildSourceRowTokenSkewness(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.mean, 0);
  assert.equal(row.variance, 0);
  assert.equal(row.stddev, 0);
  assert.equal(row.skewness, 0);
  assert.equal(row.degenerate, true);
});

test('row-token-skewness: all-identical non-zero rows -> degenerate', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'k', 500),
    ql('2026-04-20T01:00:00Z', 'k', 500),
    ql('2026-04-20T02:00:00Z', 'k', 500),
    ql('2026-04-20T03:00:00Z', 'k', 500),
  ];
  const r = buildSourceRowTokenSkewness(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.mean, 500);
  assert.equal(row.stddev, 0);
  assert.equal(row.skewness, 0);
  assert.equal(row.degenerate, true);
});

test('row-token-skewness: clamps negative total_tokens to 0', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'n', 100),
    ql('2026-04-20T01:00:00Z', 'n', 100),
    ql('2026-04-20T02:00:00Z', 'n', -50),
  ];
  const r = buildSourceRowTokenSkewness(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  // Effective samples are {100, 100, 0}: mean 200/3 ~ 66.67
  assert.ok(Math.abs(row.mean - 200 / 3) < 1e-9);
});

test('row-token-skewness: NaN total_tokens treated as 0', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'n', 100),
    ql('2026-04-20T01:00:00Z', 'n', 100),
    ql('2026-04-20T02:00:00Z', 'n', Number.NaN),
  ];
  const r = buildSourceRowTokenSkewness(q, { generatedAt: GEN });
  assert.ok(Math.abs((r.sources[0]!).mean - 200 / 3) < 1e-9);
});

test('row-token-skewness: --since/--until window gating', () => {
  const q: QueueLine[] = [
    ql('2026-04-19T00:00:00Z', 'a', 100), // pre-window
    ql('2026-04-20T00:00:00Z', 'a', 200),
    ql('2026-04-20T01:00:00Z', 'a', 200),
    ql('2026-04-20T02:00:00Z', 'a', 200),
    ql('2026-04-21T00:00:00Z', 'a', 999), // post-window (until is exclusive)
  ];
  const r = buildSourceRowTokenSkewness(q, {
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-21T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.totalRowsKept, 3);
  assert.equal(r.sources[0]!.mean, 200);
  assert.equal(r.windowStart, '2026-04-20T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-21T00:00:00Z');
});

test('row-token-skewness: --source restricts and counts dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 100),
    ql('2026-04-20T01:00:00Z', 'a', 100),
    ql('2026-04-20T02:00:00Z', 'a', 100),
    ql('2026-04-20T03:00:00Z', 'b', 50),
    ql('2026-04-20T04:00:00Z', 'b', 50),
  ];
  const r = buildSourceRowTokenSkewness(q, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.source, 'a');
  assert.equal(r.totalRowsKept, 3);
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('row-token-skewness: missing/empty source -> "unknown"', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', '', 100),
    ql('2026-04-20T01:00:00Z', '', 200),
    ql('2026-04-20T02:00:00Z', '', 300),
  ];
  const r = buildSourceRowTokenSkewness(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('row-token-skewness: --min-mean drops low-mean sources', () => {
  const q: QueueLine[] = [
    // big-mean source: mean 1000
    ql('2026-04-20T00:00:00Z', 'big', 1000),
    ql('2026-04-20T01:00:00Z', 'big', 1000),
    ql('2026-04-20T02:00:00Z', 'big', 1000),
    // small-mean source: mean ~33
    ql('2026-04-20T00:00:00Z', 'small', 10),
    ql('2026-04-20T01:00:00Z', 'small', 50),
    ql('2026-04-20T02:00:00Z', 'small', 40),
  ];
  const r = buildSourceRowTokenSkewness(q, {
    minMean: 100,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinMean, 1);
});

test('row-token-skewness: --top caps and counts overflow', () => {
  const q: QueueLine[] = [];
  // 4 sources, each 3 rows.
  for (const s of ['s1', 's2', 's3', 's4']) {
    q.push(ql('2026-04-20T00:00:00Z', s, 100));
    q.push(ql('2026-04-20T01:00:00Z', s, 100));
    q.push(ql('2026-04-20T02:00:00Z', s, 100));
  }
  const r = buildSourceRowTokenSkewness(q, { top: 2, generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('row-token-skewness: sort skew-desc puts most right-skewed first', () => {
  const q: QueueLine[] = [
    // right-skewed source
    ql('2026-04-20T00:00:00Z', 'right', 10),
    ql('2026-04-20T01:00:00Z', 'right', 10),
    ql('2026-04-20T02:00:00Z', 'right', 10),
    ql('2026-04-20T03:00:00Z', 'right', 10),
    ql('2026-04-20T04:00:00Z', 'right', 1000),
    // left-skewed source
    ql('2026-04-20T00:00:00Z', 'left', 1000),
    ql('2026-04-20T01:00:00Z', 'left', 1000),
    ql('2026-04-20T02:00:00Z', 'left', 1000),
    ql('2026-04-20T03:00:00Z', 'left', 1000),
    ql('2026-04-20T04:00:00Z', 'left', 10),
    // symmetric source
    ql('2026-04-20T00:00:00Z', 'sym', 100),
    ql('2026-04-20T01:00:00Z', 'sym', 200),
    ql('2026-04-20T02:00:00Z', 'sym', 300),
  ];
  const r = buildSourceRowTokenSkewness(q, {
    sort: 'skew-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'right');
  assert.equal(r.sources[r.sources.length - 1]!.source, 'left');
});

test('row-token-skewness: sort skew-asc puts most left-skewed first', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'right', 10),
    ql('2026-04-20T01:00:00Z', 'right', 10),
    ql('2026-04-20T02:00:00Z', 'right', 10),
    ql('2026-04-20T03:00:00Z', 'right', 10),
    ql('2026-04-20T04:00:00Z', 'right', 1000),
    ql('2026-04-20T00:00:00Z', 'left', 1000),
    ql('2026-04-20T01:00:00Z', 'left', 1000),
    ql('2026-04-20T02:00:00Z', 'left', 1000),
    ql('2026-04-20T03:00:00Z', 'left', 1000),
    ql('2026-04-20T04:00:00Z', 'left', 10),
  ];
  const r = buildSourceRowTokenSkewness(q, {
    sort: 'skew-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'left');
});

test('row-token-skewness: sort abs-skew sorts by magnitude', () => {
  const q: QueueLine[] = [
    // large negative skew
    ql('2026-04-20T00:00:00Z', 'big-neg', 1000),
    ql('2026-04-20T01:00:00Z', 'big-neg', 1000),
    ql('2026-04-20T02:00:00Z', 'big-neg', 1000),
    ql('2026-04-20T03:00:00Z', 'big-neg', 1000),
    ql('2026-04-20T04:00:00Z', 'big-neg', 10),
    // small positive skew (3 rows close, one slightly bigger)
    ql('2026-04-20T00:00:00Z', 'small-pos', 100),
    ql('2026-04-20T01:00:00Z', 'small-pos', 110),
    ql('2026-04-20T02:00:00Z', 'small-pos', 120),
    ql('2026-04-20T03:00:00Z', 'small-pos', 130),
    ql('2026-04-20T04:00:00Z', 'small-pos', 200),
  ];
  const r = buildSourceRowTokenSkewness(q, {
    sort: 'abs-skew',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'big-neg');
});

test('row-token-skewness: sort source = lex asc', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'b', 100),
    ql('2026-04-20T01:00:00Z', 'b', 200),
    ql('2026-04-20T02:00:00Z', 'b', 300),
    ql('2026-04-20T00:00:00Z', 'a', 100),
    ql('2026-04-20T01:00:00Z', 'a', 200),
    ql('2026-04-20T02:00:00Z', 'a', 300),
  ];
  const r = buildSourceRowTokenSkewness(q, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('row-token-skewness: sort rows = rowsKept desc', () => {
  const q: QueueLine[] = [
    // 3 rows
    ql('2026-04-20T00:00:00Z', 'small', 100),
    ql('2026-04-20T01:00:00Z', 'small', 200),
    ql('2026-04-20T02:00:00Z', 'small', 300),
    // 5 rows
    ql('2026-04-20T00:00:00Z', 'big', 100),
    ql('2026-04-20T01:00:00Z', 'big', 200),
    ql('2026-04-20T02:00:00Z', 'big', 300),
    ql('2026-04-20T03:00:00Z', 'big', 400),
    ql('2026-04-20T04:00:00Z', 'big', 500),
  ];
  const r = buildSourceRowTokenSkewness(q, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.sources[1]!.source, 'small');
});

test('row-token-skewness: tie-break on equal sort key is source asc', () => {
  // Two sources with identical skewness values (both perfectly symmetric).
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'b', 50),
    ql('2026-04-20T01:00:00Z', 'b', 100),
    ql('2026-04-20T02:00:00Z', 'b', 150),
    ql('2026-04-20T00:00:00Z', 'a', 50),
    ql('2026-04-20T01:00:00Z', 'a', 100),
    ql('2026-04-20T02:00:00Z', 'a', 150),
  ];
  const r = buildSourceRowTokenSkewness(q, {
    sort: 'skew-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('row-token-skewness: report shape stable (JSON keys)', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 100),
    ql('2026-04-20T01:00:00Z', 'a', 200),
    ql('2026-04-20T02:00:00Z', 'a', 300),
  ];
  const r = buildSourceRowTokenSkewness(q, { generatedAt: GEN });
  assert.deepEqual(Object.keys(r).sort(), [
    'droppedBelowMinMean',
    'droppedBelowMinRows',
    'droppedBelowTopCap',
    'droppedInvalidHourStart',
    'droppedSourceFilter',
    'droppedTooFewRowsForSkewness',
    'generatedAt',
    'minMean',
    'minRows',
    'sort',
    'source',
    'sources',
    'top',
    'totalRowsKept',
    'totalSources',
    'windowEnd',
    'windowStart',
  ]);
  assert.deepEqual(Object.keys(r.sources[0]!).sort(), [
    'absSkewness',
    'degenerate',
    'mean',
    'rowsKept',
    'skewness',
    'source',
    'stddev',
    'variance',
  ]);
});

test('row-token-skewness: minRows display gate counts droppedBelowMinRows', () => {
  // s1: 3 rows (will be filtered by minRows=5)
  // s2: 5 rows (will pass)
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 's1', 100),
    ql('2026-04-20T01:00:00Z', 's1', 200),
    ql('2026-04-20T02:00:00Z', 's1', 300),
    ql('2026-04-20T00:00:00Z', 's2', 100),
    ql('2026-04-20T01:00:00Z', 's2', 200),
    ql('2026-04-20T02:00:00Z', 's2', 300),
    ql('2026-04-20T03:00:00Z', 's2', 400),
    ql('2026-04-20T04:00:00Z', 's2', 500),
  ];
  const r = buildSourceRowTokenSkewness(q, {
    minRows: 5,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's2');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('row-token-skewness: absSkewness column always non-negative', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'r', 10),
    ql('2026-04-20T01:00:00Z', 'r', 10),
    ql('2026-04-20T02:00:00Z', 'r', 1000),
    ql('2026-04-20T00:00:00Z', 'l', 1000),
    ql('2026-04-20T01:00:00Z', 'l', 1000),
    ql('2026-04-20T02:00:00Z', 'l', 10),
  ];
  const r = buildSourceRowTokenSkewness(q, { generatedAt: GEN });
  for (const s of r.sources) {
    assert.ok(s.absSkewness >= 0);
    assert.ok(Math.abs(s.absSkewness - Math.abs(s.skewness)) < 1e-12);
  }
});
