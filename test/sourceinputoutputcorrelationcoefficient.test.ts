import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceInputOutputCorrelationCoefficient } from '../src/sourceinputoutputcorrelationcoefficient.js';
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

test('source-iocc: empty input -> empty report with defaults', () => {
  const r = buildSourceInputOutputCorrelationCoefficient([], {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRows, 0);
  assert.equal(r.totalPositivePairs, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 3);
  assert.equal(r.minPositivePairs, 2);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'r-desc');
});

test('source-iocc: rejects bad minRows', () => {
  assert.throws(() =>
    buildSourceInputOutputCorrelationCoefficient([], { minRows: 0 }),
  );
  assert.throws(() =>
    buildSourceInputOutputCorrelationCoefficient([], { minRows: 1.5 }),
  );
});

test('source-iocc: rejects bad minPositivePairs', () => {
  assert.throws(() =>
    buildSourceInputOutputCorrelationCoefficient([], { minPositivePairs: 1 }),
  );
  assert.throws(() =>
    buildSourceInputOutputCorrelationCoefficient([], {
      minPositivePairs: 2.5,
    }),
  );
});

test('source-iocc: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceInputOutputCorrelationCoefficient([], {
      // @ts-expect-error invalid sort key
      sort: 'bogus',
    }),
  );
});

test('source-iocc: rejects bad top', () => {
  assert.throws(() =>
    buildSourceInputOutputCorrelationCoefficient([], { top: 0 }),
  );
  assert.throws(() =>
    buildSourceInputOutputCorrelationCoefficient([], { top: 1.5 }),
  );
});

test('source-iocc: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceInputOutputCorrelationCoefficient([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceInputOutputCorrelationCoefficient([], { until: 'not-a-date' }),
  );
});

test('source-iocc: perfect positive correlation -> r == 1', () => {
  // out == 2*in for every row -> perfect linear -> r = 1
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 10, 20),
    ql('2026-04-20T01:00:00Z', 'a', 20, 40),
    ql('2026-04-20T02:00:00Z', 'a', 30, 60),
    ql('2026-04-20T03:00:00Z', 'a', 40, 80),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
  });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.positivePairs, 4);
  assert.ok(Math.abs(a.r - 1) < 1e-12, `expected r ~ 1, got ${a.r}`);
  assert.equal(a.degenerate, false);
});

test('source-iocc: perfect negative correlation -> r == -1', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 10, 80),
    ql('2026-04-20T01:00:00Z', 'a', 20, 60),
    ql('2026-04-20T02:00:00Z', 'a', 30, 40),
    ql('2026-04-20T03:00:00Z', 'a', 40, 20),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
  });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.ok(Math.abs(a.r + 1) < 1e-12, `expected r ~ -1, got ${a.r}`);
});

test('source-iocc: zero-variance on input -> degenerate, r=0', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 10, 5),
    ql('2026-04-20T01:00:00Z', 'a', 10, 7),
    ql('2026-04-20T02:00:00Z', 'a', 10, 9),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
  });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.degenerate, true);
  assert.equal(a.r, 0);
});

test('source-iocc: zero-output rows excluded from positivePairs', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 10, 0), // excluded (out=0)
    ql('2026-04-20T01:00:00Z', 'a', 0, 5), // excluded (in=0)
    ql('2026-04-20T02:00:00Z', 'a', 10, 20),
    ql('2026-04-20T03:00:00Z', 'a', 20, 40),
    ql('2026-04-20T04:00:00Z', 'a', 30, 60),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
  });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.rows, 5);
  assert.equal(a.positivePairs, 3);
  assert.ok(Math.abs(a.r - 1) < 1e-12);
});

test('source-iocc: known r value for non-trivial pairs', () => {
  // Pearson r for (1,2),(2,2),(3,4),(4,5) ~ 0.9276
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 1, 2),
    ql('2026-04-20T01:00:00Z', 'a', 2, 2),
    ql('2026-04-20T02:00:00Z', 'a', 3, 4),
    ql('2026-04-20T03:00:00Z', 'a', 4, 5),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
  });
  const a = r.sources.find((s) => s.source === 'a')!;
  // hand-computed: meanIn=2.5 meanOut=3.25
  // sxy = (1-2.5)(2-3.25)+(2-2.5)(2-3.25)+(3-2.5)(4-3.25)+(4-2.5)(5-3.25)
  //     = 1.875 + 0.625 + 0.375 + 2.625 = 5.5
  // sxx = 2.25+0.25+0.25+2.25 = 5
  // syy = 1.5625+1.5625+0.5625+3.0625 = 6.75
  // r = 5.5 / sqrt(5*6.75) = 5.5 / sqrt(33.75) ~ 0.94673
  assert.ok(
    Math.abs(a.r - 0.946729) < 1e-4,
    `expected r ~ 0.9467, got ${a.r}`,
  );
});

test('source-iocc: r is invariant to scale of either axis', () => {
  const q1 = [
    ql('2026-04-20T00:00:00Z', 'a', 10, 1),
    ql('2026-04-20T01:00:00Z', 'a', 20, 4),
    ql('2026-04-20T02:00:00Z', 'a', 30, 5),
    ql('2026-04-20T03:00:00Z', 'a', 40, 9),
  ];
  const q2 = [
    ql('2026-04-20T00:00:00Z', 'a', 100, 1000),
    ql('2026-04-20T01:00:00Z', 'a', 200, 4000),
    ql('2026-04-20T02:00:00Z', 'a', 300, 5000),
    ql('2026-04-20T03:00:00Z', 'a', 400, 9000),
  ];
  const r1 = buildSourceInputOutputCorrelationCoefficient(q1, {
    generatedAt: GEN,
  });
  const r2 = buildSourceInputOutputCorrelationCoefficient(q2, {
    generatedAt: GEN,
  });
  assert.ok(
    Math.abs(r1.sources[0]!.r - r2.sources[0]!.r) < 1e-12,
    'r should be scale-invariant',
  );
});

test('source-iocc: drops invalid hour_start', () => {
  const q = [
    ql('not-a-date', 'a', 10, 20),
    ql('2026-04-20T00:00:00Z', 'a', 10, 20),
    ql('2026-04-20T01:00:00Z', 'a', 20, 40),
    ql('2026-04-20T02:00:00Z', 'a', 30, 60),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.rows, 3);
});

test('source-iocc: window since/until inclusive/exclusive', () => {
  const q = [
    ql('2026-04-19T23:59:59Z', 'a', 10, 20),
    ql('2026-04-20T00:00:00Z', 'a', 10, 20),
    ql('2026-04-20T12:00:00Z', 'a', 20, 40),
    ql('2026-04-21T00:00:00Z', 'a', 30, 60),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-21T00:00:00Z',
    minRows: 1,
  });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.rows, 2);
  assert.equal(a.positivePairs, 2);
});

test('source-iocc: source filter narrows result', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 10, 20),
    ql('2026-04-20T01:00:00Z', 'a', 20, 40),
    ql('2026-04-20T02:00:00Z', 'a', 30, 60),
    ql('2026-04-20T00:00:00Z', 'b', 10, 5),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
    source: 'a',
    minRows: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 1);
});

test('source-iocc: empty source string -> "unknown"', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', '', 10, 20),
    ql('2026-04-20T01:00:00Z', '', 20, 40),
    ql('2026-04-20T02:00:00Z', '', 30, 60),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('source-iocc: min-rows filter', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 10, 20),
    ql('2026-04-20T01:00:00Z', 'a', 20, 40),
    ql('2026-04-20T00:00:00Z', 'b', 10, 20),
    ql('2026-04-20T01:00:00Z', 'b', 20, 40),
    ql('2026-04-20T02:00:00Z', 'b', 30, 60),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
    minRows: 3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('source-iocc: min-positive-pairs filter', () => {
  const q = [
    // a: 4 rows but only 1 positive pair (rest have output=0)
    ql('2026-04-20T00:00:00Z', 'a', 10, 0),
    ql('2026-04-20T01:00:00Z', 'a', 20, 0),
    ql('2026-04-20T02:00:00Z', 'a', 30, 0),
    ql('2026-04-20T03:00:00Z', 'a', 40, 5),
    // b: 3 positive pairs
    ql('2026-04-20T00:00:00Z', 'b', 10, 20),
    ql('2026-04-20T01:00:00Z', 'b', 20, 40),
    ql('2026-04-20T02:00:00Z', 'b', 30, 60),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
    minPositivePairs: 3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinPositivePairs, 1);
});

test('source-iocc: sort by r-desc', () => {
  const q = [
    // a: r ~ 1
    ql('2026-04-20T00:00:00Z', 'a', 10, 20),
    ql('2026-04-20T01:00:00Z', 'a', 20, 40),
    ql('2026-04-20T02:00:00Z', 'a', 30, 60),
    // b: r ~ -1
    ql('2026-04-20T00:00:00Z', 'b', 10, 60),
    ql('2026-04-20T01:00:00Z', 'b', 20, 40),
    ql('2026-04-20T02:00:00Z', 'b', 30, 20),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
    sort: 'r-desc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b'],
  );
});

test('source-iocc: sort by r-asc', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 10, 20),
    ql('2026-04-20T01:00:00Z', 'a', 20, 40),
    ql('2026-04-20T02:00:00Z', 'a', 30, 60),
    ql('2026-04-20T00:00:00Z', 'b', 10, 60),
    ql('2026-04-20T01:00:00Z', 'b', 20, 40),
    ql('2026-04-20T02:00:00Z', 'b', 30, 20),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
    sort: 'r-asc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'a'],
  );
});

test('source-iocc: sort by abs-r', () => {
  const q = [
    // a: r ~ 1
    ql('2026-04-20T00:00:00Z', 'a', 10, 20),
    ql('2026-04-20T01:00:00Z', 'a', 20, 40),
    ql('2026-04-20T02:00:00Z', 'a', 30, 60),
    // b: r ~ 0 (degenerate due to flat input)
    ql('2026-04-20T00:00:00Z', 'b', 10, 5),
    ql('2026-04-20T01:00:00Z', 'b', 10, 7),
    ql('2026-04-20T02:00:00Z', 'b', 10, 9),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
    sort: 'abs-r',
  });
  // a has |r|=1, b has |r|=0
  assert.equal(r.sources[0]!.source, 'a');
});

test('source-iocc: sort by source asc', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'b', 10, 20),
    ql('2026-04-20T01:00:00Z', 'b', 20, 40),
    ql('2026-04-20T02:00:00Z', 'b', 30, 60),
    ql('2026-04-20T00:00:00Z', 'a', 10, 20),
    ql('2026-04-20T01:00:00Z', 'a', 20, 40),
    ql('2026-04-20T02:00:00Z', 'a', 30, 60),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b'],
  );
});

test('source-iocc: tie on r -> source asc as tiebreak', () => {
  const q = [
    // both perfectly correlated
    ql('2026-04-20T00:00:00Z', 'b', 10, 20),
    ql('2026-04-20T01:00:00Z', 'b', 20, 40),
    ql('2026-04-20T02:00:00Z', 'b', 30, 60),
    ql('2026-04-20T00:00:00Z', 'a', 1, 10),
    ql('2026-04-20T01:00:00Z', 'a', 2, 20),
    ql('2026-04-20T02:00:00Z', 'a', 3, 30),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
    sort: 'r-desc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b'],
  );
});

test('source-iocc: top cap drops survivors', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 10, 20),
    ql('2026-04-20T01:00:00Z', 'a', 20, 40),
    ql('2026-04-20T02:00:00Z', 'a', 30, 60),
    ql('2026-04-20T00:00:00Z', 'b', 10, 20),
    ql('2026-04-20T01:00:00Z', 'b', 20, 40),
    ql('2026-04-20T02:00:00Z', 'b', 30, 60),
    ql('2026-04-20T00:00:00Z', 'c', 10, 20),
    ql('2026-04-20T01:00:00Z', 'c', 20, 40),
    ql('2026-04-20T02:00:00Z', 'c', 30, 60),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('source-iocc: r clamped to [-1, +1]', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 1, 2),
    ql('2026-04-20T01:00:00Z', 'a', 2, 4),
    ql('2026-04-20T02:00:00Z', 'a', 3, 6),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
  });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.ok(a.r >= -1 && a.r <= 1);
});

test('source-iocc: deterministic with fixed generatedAt', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 10, 20),
    ql('2026-04-20T01:00:00Z', 'a', 20, 40),
    ql('2026-04-20T02:00:00Z', 'a', 30, 60),
  ];
  const r1 = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
  });
  const r2 = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
  });
  assert.equal(JSON.stringify(r1), JSON.stringify(r2));
});

test('source-iocc: negative input/output treated as 0 (excluded from positivePairs)', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', -5, 20),
    ql('2026-04-20T01:00:00Z', 'a', 10, -3),
    ql('2026-04-20T02:00:00Z', 'a', 20, 40),
    ql('2026-04-20T03:00:00Z', 'a', 30, 60),
  ];
  const r = buildSourceInputOutputCorrelationCoefficient(q, {
    generatedAt: GEN,
  });
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.rows, 4);
  assert.equal(a.positivePairs, 2);
});
