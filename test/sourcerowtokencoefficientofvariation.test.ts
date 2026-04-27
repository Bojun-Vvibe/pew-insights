import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenCoefficientOfVariation } from '../src/sourcerowtokencoefficientofvariation.js';
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

test('row-token-cv: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenCoefficientOfVariation([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 2);
  assert.equal(r.minMean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'cv-desc');
  assert.equal(r.generatedAt, GEN);
});

test('row-token-cv: rejects bad minRows', () => {
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], { minRows: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], { minRows: 1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], { minRows: 2.5 }),
  );
});

test('row-token-cv: rejects bad minMean', () => {
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], { minMean: -1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], {
      minMean: Number.POSITIVE_INFINITY,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], { minMean: Number.NaN }),
  );
});

test('row-token-cv: rejects bad top', () => {
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], { top: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], { top: -1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], { top: 1.5 }),
  );
});

test('row-token-cv: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], {
      // @ts-expect-error -- intentional
      sort: 'bogus',
    }),
  );
});

test('row-token-cv: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], { until: 'also-bad' }),
  );
});

test('row-token-cv: identical rows -> cv = 0', () => {
  // 4 identical rows -> stddev 0, cv 0, degenerate=false (mean>0).
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 100),
    ql('2026-01-01T01:00:00Z', 'a', 100),
    ql('2026-01-01T02:00:00Z', 'a', 100),
    ql('2026-01-01T03:00:00Z', 'a', 100),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.rowsKept, 4);
  assert.equal(row.mean, 100);
  assert.equal(row.stddev, 0);
  assert.equal(row.cv, 0);
  assert.equal(row.degenerate, false);
});

test('row-token-cv: all-zero rows -> degenerate, cv=0', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 0),
    ql('2026-01-01T01:00:00Z', 'a', 0),
    ql('2026-01-01T02:00:00Z', 'a', 0),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.mean, 0);
  assert.equal(row.stddev, 0);
  assert.equal(row.cv, 0);
  assert.equal(row.degenerate, true);
});

test('row-token-cv: known-value example', () => {
  // values = [10, 20]: mean=15, var = ((10-15)^2 + (20-15)^2)/2 = 25,
  // stddev = 5, cv = 5/15 = 0.3333...
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 10),
    ql('2026-01-01T01:00:00Z', 'a', 20),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.mean, 15);
  assert.equal(row.stddev, 5);
  assert.equal(row.variance, 25);
  assert.ok(Math.abs(row.cv - 1 / 3) < 1e-12);
  assert.equal(row.degenerate, false);
});

test('row-token-cv: scale invariance — doubling all values leaves cv unchanged', () => {
  // The defining property of CV: scale-free.
  const q1: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 10),
    ql('2026-01-01T01:00:00Z', 'a', 20),
    ql('2026-01-01T02:00:00Z', 'a', 30),
  ];
  const q2: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 100),
    ql('2026-01-01T01:00:00Z', 'a', 200),
    ql('2026-01-01T02:00:00Z', 'a', 300),
  ];
  const r1 = buildSourceRowTokenCoefficientOfVariation(q1, {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenCoefficientOfVariation(q2, {
    generatedAt: GEN,
  });
  assert.ok(
    Math.abs(r1.sources[0]!.cv - r2.sources[0]!.cv) < 1e-12,
    `expected scale invariance: ${r1.sources[0]!.cv} vs ${r2.sources[0]!.cv}`,
  );
  // mean and stddev should both scale 10x.
  assert.ok(Math.abs(r2.sources[0]!.mean - r1.sources[0]!.mean * 10) < 1e-9);
  assert.ok(Math.abs(r2.sources[0]!.stddev - r1.sources[0]!.stddev * 10) < 1e-9);
});

test('row-token-cv: negative and non-finite tokens clamped to 0', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 100),
    ql('2026-01-01T01:00:00Z', 'a', -5), // -> 0
    ql('2026-01-01T02:00:00Z', 'a', NaN), // -> 0
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.rowsKept, 3);
  assert.ok(Math.abs(row.mean - 100 / 3) < 1e-9);
});

test('row-token-cv: drops below 2-row floor', () => {
  const queue: QueueLine[] = [ql('2026-01-01T00:00:00Z', 'a', 100)];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalRowsKept, 1);
  assert.equal(r.droppedTooFewRowsForCv, 1);
  assert.equal(r.sources.length, 0);
});

test('row-token-cv: invalid hour_start dropped, counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql('2026-01-01T00:00:00Z', 'a', 50),
    ql('2026-01-01T01:00:00Z', 'a', 150),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 2);
});

test('row-token-cv: source filter counts mismatches', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 10),
    ql('2026-01-01T01:00:00Z', 'a', 20),
    ql('2026-01-01T02:00:00Z', 'b', 30),
    ql('2026-01-01T03:00:00Z', 'b', 40),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.source, 'a');
});

test('row-token-cv: window since/until filter', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 10), // before since
    ql('2026-01-02T00:00:00Z', 'a', 20),
    ql('2026-01-02T01:00:00Z', 'a', 30),
    ql('2026-01-03T00:00:00Z', 'a', 40), // == until -> excluded
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    since: '2026-01-02T00:00:00Z',
    until: '2026-01-03T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 2);
  assert.equal(r.sources[0]!.mean, 25);
  assert.equal(r.windowStart, '2026-01-02T00:00:00Z');
  assert.equal(r.windowEnd, '2026-01-03T00:00:00Z');
});

test('row-token-cv: empty source string normalises to "unknown"', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', '', 10),
    ql('2026-01-01T01:00:00Z', '', 20),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('row-token-cv: minRows display gate', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 10),
    ql('2026-01-01T01:00:00Z', 'a', 20),
    ql('2026-01-01T02:00:00Z', 'b', 10),
    ql('2026-01-01T03:00:00Z', 'b', 20),
    ql('2026-01-01T04:00:00Z', 'b', 30),
    ql('2026-01-01T05:00:00Z', 'b', 40),
    ql('2026-01-01T06:00:00Z', 'b', 50),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    minRows: 5,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

test('row-token-cv: minMean display gate (strict <)', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'small', 1),
    ql('2026-01-01T01:00:00Z', 'small', 2),
    ql('2026-01-01T02:00:00Z', 'big', 100),
    ql('2026-01-01T03:00:00Z', 'big', 200),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    minMean: 10,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinMean, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('row-token-cv: top cap with leftover counted', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    const s = `s${i}`;
    queue.push(ql('2026-01-01T00:00:00Z', s, 10 * (i + 1)));
    queue.push(ql('2026-01-01T01:00:00Z', s, 20 * (i + 1)));
  }
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 3);
  assert.equal(r.top, 2);
});

test('row-token-cv: sort cv-desc default puts most dispersed first', () => {
  // a: [10,10] cv=0; b: [10,30] cv=0.5; c: [10,90] cv=0.8
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 10),
    ql('2026-01-01T01:00:00Z', 'a', 10),
    ql('2026-01-01T02:00:00Z', 'b', 10),
    ql('2026-01-01T03:00:00Z', 'b', 30),
    ql('2026-01-01T04:00:00Z', 'c', 10),
    ql('2026-01-01T05:00:00Z', 'c', 90),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 3);
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
  assert.equal(r.sources[2]!.source, 'a');
});

test('row-token-cv: sort cv-asc reverses', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 10),
    ql('2026-01-01T01:00:00Z', 'a', 10),
    ql('2026-01-01T02:00:00Z', 'b', 10),
    ql('2026-01-01T03:00:00Z', 'b', 30),
    ql('2026-01-01T04:00:00Z', 'c', 10),
    ql('2026-01-01T05:00:00Z', 'c', 90),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    sort: 'cv-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
  assert.equal(r.sources[2]!.source, 'c');
});

test('row-token-cv: sort by source (lex) tiebreaks by source asc', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'zebra', 10),
    ql('2026-01-01T01:00:00Z', 'zebra', 20),
    ql('2026-01-01T02:00:00Z', 'apple', 10),
    ql('2026-01-01T03:00:00Z', 'apple', 20),
    ql('2026-01-01T04:00:00Z', 'mango', 10),
    ql('2026-01-01T05:00:00Z', 'mango', 20),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'apple');
  assert.equal(r.sources[1]!.source, 'mango');
  assert.equal(r.sources[2]!.source, 'zebra');
});

test('row-token-cv: sort by mean desc', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'small', 1),
    ql('2026-01-01T01:00:00Z', 'small', 3),
    ql('2026-01-01T02:00:00Z', 'big', 100),
    ql('2026-01-01T03:00:00Z', 'big', 300),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    sort: 'mean',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.sources[1]!.source, 'small');
});

test('row-token-cv: sort by stddev desc', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'small', 1),
    ql('2026-01-01T01:00:00Z', 'small', 3),
    ql('2026-01-01T02:00:00Z', 'big', 100),
    ql('2026-01-01T03:00:00Z', 'big', 300),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    sort: 'stddev',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.sources[1]!.source, 'small');
});

test('row-token-cv: report carries sort/min-rows/min-mean/top into output', () => {
  const r = buildSourceRowTokenCoefficientOfVariation([], {
    minRows: 3,
    minMean: 5,
    top: 4,
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.minRows, 3);
  assert.equal(r.minMean, 5);
  assert.equal(r.top, 4);
  assert.equal(r.sort, 'rows');
});

test('row-token-cv: deterministic across two builds', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 10),
    ql('2026-01-01T01:00:00Z', 'a', 90),
    ql('2026-01-01T02:00:00Z', 'b', 50),
    ql('2026-01-01T03:00:00Z', 'b', 50),
  ];
  const r1 = buildSourceRowTokenCoefficientOfVariation(queue, {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenCoefficientOfVariation(queue, {
    generatedAt: GEN,
  });
  assert.deepEqual(r1, r2);
});

test('row-token-cv: minCv default 0 keeps zero-cv sources', () => {
  // Identical-row source has cv=0; default minCv=0 must keep it
  // (strict-< semantics).
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'flat', 100),
    ql('2026-01-01T01:00:00Z', 'flat', 100),
    ql('2026-01-01T02:00:00Z', 'spread', 10),
    ql('2026-01-01T03:00:00Z', 'spread', 90),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.minCv, 0);
  assert.equal(r.droppedBelowMinCv, 0);
  assert.equal(r.sources.length, 2);
});

test('row-token-cv: minCv 0.0001 drops exactly cv=0 sources (strict <)', () => {
  // Verifies the "strict <" semantics documented in the source:
  // a positive threshold of any size drops cv=0 rows.
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'flat', 100),
    ql('2026-01-01T01:00:00Z', 'flat', 100),
    ql('2026-01-01T02:00:00Z', 'spread', 10),
    ql('2026-01-01T03:00:00Z', 'spread', 90),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    minCv: 0.0001,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinCv, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'spread');
});

test('row-token-cv: minCv 1.0 hides everything tighter than exponential baseline', () => {
  // a: cv = 1/3 (below 1.0) -> dropped
  // b: cv = 0.8 (below 1.0) -> dropped
  // c: cv =~ 1.0 boundary case
  // values [10,90]: mean=50, var=1600, stddev=40, cv=0.8
  // values [1,99]: mean=50, var=2401, stddev=49, cv=0.98
  // values [0,100]: mean=50, var=2500, stddev=50, cv=1.0 (boundary, kept by strict <)
  // values [1,99,200]: mean=100, var=approx 6800, stddev~82.5, cv~0.825 -> dropped
  // Use clear cases:
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 10), // cv = 1/3
    ql('2026-01-01T01:00:00Z', 'a', 20),
    ql('2026-01-01T02:00:00Z', 'b', 1), // cv = 49/50 = 0.98 < 1
    ql('2026-01-01T03:00:00Z', 'b', 99),
    ql('2026-01-01T04:00:00Z', 'c', 0), // cv = 50/50 = 1.0 boundary
    ql('2026-01-01T05:00:00Z', 'c', 100),
  ];
  const r = buildSourceRowTokenCoefficientOfVariation(queue, {
    minCv: 1.0,
    generatedAt: GEN,
  });
  // Strict < 1.0: c kept (cv=1.0 exactly), a + b dropped.
  assert.equal(r.droppedBelowMinCv, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'c');
});

test('row-token-cv: rejects bad minCv', () => {
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], { minCv: -1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], {
      minCv: Number.POSITIVE_INFINITY,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfVariation([], { minCv: Number.NaN }),
  );
});

test('row-token-cv: minCv carried into report; default 0 preserves v0.6.87 semantics', () => {
  const r1 = buildSourceRowTokenCoefficientOfVariation([], {
    generatedAt: GEN,
  });
  assert.equal(r1.minCv, 0);
  assert.equal(r1.droppedBelowMinCv, 0);

  const r2 = buildSourceRowTokenCoefficientOfVariation([], {
    minCv: 0.5,
    generatedAt: GEN,
  });
  assert.equal(r2.minCv, 0.5);
});
