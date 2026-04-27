import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenGini } from '../src/sourcerowtokengini.js';
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

test('row-token-gini: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenGini([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 2);
  assert.equal(r.minMean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'gini-desc');
  assert.equal(r.generatedAt, GEN);
});

test('row-token-gini: rejects bad minRows', () => {
  assert.throws(() => buildSourceRowTokenGini([], { minRows: 0 }));
  assert.throws(() => buildSourceRowTokenGini([], { minRows: 1 }));
  assert.throws(() => buildSourceRowTokenGini([], { minRows: 2.5 }));
});

test('row-token-gini: rejects bad minMean', () => {
  assert.throws(() => buildSourceRowTokenGini([], { minMean: -1 }));
  assert.throws(() =>
    buildSourceRowTokenGini([], { minMean: Number.POSITIVE_INFINITY }),
  );
  assert.throws(() =>
    buildSourceRowTokenGini([], { minMean: Number.NaN }),
  );
});

test('row-token-gini: rejects bad top', () => {
  assert.throws(() => buildSourceRowTokenGini([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenGini([], { top: -1 }));
  assert.throws(() => buildSourceRowTokenGini([], { top: 1.5 }));
});

test('row-token-gini: rejects bad sort', () => {
  assert.throws(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildSourceRowTokenGini([], { sort: 'bogus' as any }),
  );
});

test('row-token-gini: rejects bad since/until', () => {
  assert.throws(() => buildSourceRowTokenGini([], { since: 'not-a-date' }));
  assert.throws(() => buildSourceRowTokenGini([], { until: 'not-a-date' }));
});

test('row-token-gini: bad hour_start increments dropped counter', () => {
  const q = [
    ql('not-a-date', 'a', 5),
    ql('2026-04-27T00:00:00.000Z', 'a', 5),
    ql('2026-04-27T01:00:00.000Z', 'a', 5),
  ];
  const r = buildSourceRowTokenGini(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalRowsKept, 2);
});

test('row-token-gini: all-equal positive rows -> gini = 0', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 100),
    ql('2026-04-27T02:00:00.000Z', 'a', 100),
    ql('2026-04-27T03:00:00.000Z', 'a', 100),
  ];
  const r = buildSourceRowTokenGini(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'a');
  assert.equal(row.gini, 0);
  assert.equal(row.giniUnbiased, 0);
  assert.equal(row.mean, 100);
  assert.equal(row.median, 100);
  assert.equal(row.meanToMedian, 1);
  assert.equal(row.degenerateMedian, false);
});

test('row-token-gini: all-zero rows dropped as zero-mass', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 0),
    ql('2026-04-27T01:00:00.000Z', 'a', 0),
    ql('2026-04-27T02:00:00.000Z', 'a', 0),
  ];
  const r = buildSourceRowTokenGini(q, { generatedAt: GEN });
  assert.equal(r.droppedZeroMassForGini, 1);
  assert.equal(r.sources.length, 0);
  // Rows still counted in totalRowsKept (the global denominator).
  assert.equal(r.totalRowsKept, 3);
});

test('row-token-gini: single row dropped as too-few-rows', () => {
  const q = [ql('2026-04-27T00:00:00.000Z', 'a', 100)];
  const r = buildSourceRowTokenGini(q, { generatedAt: GEN });
  assert.equal(r.droppedTooFewRowsForGini, 1);
  assert.equal(r.sources.length, 0);
});

test('row-token-gini: classic [1,2,3,4] textbook value', () => {
  // For x = [1,2,3,4], n=4, S=10, weighted = 1*1+2*2+3*3+4*4 = 30
  // G = (2*30 - 5*10) / (4*10) = 10 / 40 = 0.25
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 2),
    ql('2026-04-27T02:00:00.000Z', 'a', 3),
    ql('2026-04-27T03:00:00.000Z', 'a', 4),
  ];
  const r = buildSourceRowTokenGini(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.gini - 0.25) < 1e-12, `gini=${row.gini}`);
  // unbiased = 4/3 * 0.25 = 0.3333...
  assert.ok(Math.abs(row.giniUnbiased - 1 / 3) < 1e-12);
  assert.equal(row.mean, 2.5);
  assert.equal(row.median, 2.5);
  assert.equal(row.meanToMedian, 1);
});

test('row-token-gini: single non-zero row in n=2 -> gini approaches (1 - 1/n)', () => {
  // x = [0, 100], n=2, S=100, weighted = 1*0 + 2*100 = 200
  // G = (400 - 3*100) / (2*100) = 100/200 = 0.5 = 1 - 1/n
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 0),
    ql('2026-04-27T01:00:00.000Z', 'a', 100),
  ];
  const r = buildSourceRowTokenGini(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.gini - 0.5) < 1e-12, `gini=${row.gini}`);
  // unbiased = 2/1 * 0.5 = 1.0
  assert.ok(Math.abs(row.giniUnbiased - 1.0) < 1e-12);
  // median of [0, 100] = 50, so degenerateMedian = false, mean/median = 50/50 = 1
  assert.equal(row.median, 50);
  assert.equal(row.degenerateMedian, false);
});

test('row-token-gini: heavy concentration -> high gini', () => {
  // 9 zeros + 1 huge value: x = [0,0,0,0,0,0,0,0,0,1000], n=10, S=1000
  // weighted = 10 * 1000 = 10000
  // G = (20000 - 11*1000) / (10*1000) = 9000/10000 = 0.9 = 1 - 1/n
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 0),
    ql('2026-04-27T01:00:00.000Z', 'a', 0),
    ql('2026-04-27T02:00:00.000Z', 'a', 0),
    ql('2026-04-27T03:00:00.000Z', 'a', 0),
    ql('2026-04-27T04:00:00.000Z', 'a', 0),
    ql('2026-04-27T05:00:00.000Z', 'a', 0),
    ql('2026-04-27T06:00:00.000Z', 'a', 0),
    ql('2026-04-27T07:00:00.000Z', 'a', 0),
    ql('2026-04-27T08:00:00.000Z', 'a', 0),
    ql('2026-04-27T09:00:00.000Z', 'a', 1000),
  ];
  const r = buildSourceRowTokenGini(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.gini - 0.9) < 1e-12, `gini=${row.gini}`);
  assert.equal(row.degenerateMedian, true);
  assert.equal(row.meanToMedian, 0);
});

test('row-token-gini: ordering of rows does not affect gini (sort-invariant)', () => {
  const q1 = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 2),
    ql('2026-04-27T02:00:00.000Z', 'a', 3),
    ql('2026-04-27T03:00:00.000Z', 'a', 4),
  ];
  const q2 = [
    ql('2026-04-27T00:00:00.000Z', 'a', 4),
    ql('2026-04-27T01:00:00.000Z', 'a', 1),
    ql('2026-04-27T02:00:00.000Z', 'a', 3),
    ql('2026-04-27T03:00:00.000Z', 'a', 2),
  ];
  const r1 = buildSourceRowTokenGini(q1, { generatedAt: GEN });
  const r2 = buildSourceRowTokenGini(q2, { generatedAt: GEN });
  assert.equal(r1.sources[0]!.gini, r2.sources[0]!.gini);
});

test('row-token-gini: scale-invariance — multiplying all rows by k preserves gini', () => {
  const q1 = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 2),
    ql('2026-04-27T02:00:00.000Z', 'a', 3),
    ql('2026-04-27T03:00:00.000Z', 'a', 4),
  ];
  const q2 = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1000),
    ql('2026-04-27T01:00:00.000Z', 'a', 2000),
    ql('2026-04-27T02:00:00.000Z', 'a', 3000),
    ql('2026-04-27T03:00:00.000Z', 'a', 4000),
  ];
  const r1 = buildSourceRowTokenGini(q1, { generatedAt: GEN });
  const r2 = buildSourceRowTokenGini(q2, { generatedAt: GEN });
  assert.ok(Math.abs(r1.sources[0]!.gini - r2.sources[0]!.gini) < 1e-12);
});

test('row-token-gini: negative + non-finite total_tokens clamped to 0', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 'a', -50),
    ql('2026-04-27T01:00:00.000Z', 'a', 50),
    { ...ql('2026-04-27T02:00:00.000Z', 'a', 0), total_tokens: NaN as unknown as number },
    { ...ql('2026-04-27T03:00:00.000Z', 'a', 0), total_tokens: Infinity as unknown as number },
  ];
  const r = buildSourceRowTokenGini(q, { generatedAt: GEN });
  // x clamped = [0, 50, 0, 0], n=4, S=50; sorted asc = [0,0,0,50]
  // weighted = 1*0+2*0+3*0+4*50 = 200; G = (400 - 5*50)/(4*50) = 150/200 = 0.75
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.gini - 0.75) < 1e-12);
});

test('row-token-gini: missing source -> "unknown"', () => {
  const q: QueueLine[] = [
    { ...ql('2026-04-27T00:00:00.000Z', '', 5), source: '' },
    { ...ql('2026-04-27T01:00:00.000Z', '', 5), source: '' },
  ];
  const r = buildSourceRowTokenGini(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('row-token-gini: since/until window filtering', () => {
  const q = [
    ql('2026-04-26T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T00:00:00.000Z', 'a', 2),
    ql('2026-04-27T12:00:00.000Z', 'a', 3),
    ql('2026-04-28T00:00:00.000Z', 'a', 4),
  ];
  const r = buildSourceRowTokenGini(q, {
    generatedAt: GEN,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
  });
  assert.equal(r.totalRowsKept, 2);
  // x = [2, 3]; G = ?
  // weighted = 1*2 + 2*3 = 8; S=5; G = (16 - 3*5)/(2*5) = 1/10 = 0.1
  assert.ok(Math.abs(r.sources[0]!.gini - 0.1) < 1e-12);
});

test('row-token-gini: source filter restricts and counts dropped', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 2),
    ql('2026-04-27T02:00:00.000Z', 'b', 100),
    ql('2026-04-27T03:00:00.000Z', 'b', 200),
  ];
  const r = buildSourceRowTokenGini(q, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.source, 'a');
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('row-token-gini: minRows display gate', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 2),
    ql('2026-04-27T02:00:00.000Z', 'a', 3),
    ql('2026-04-27T03:00:00.000Z', 'b', 1),
    ql('2026-04-27T04:00:00.000Z', 'b', 2),
  ];
  const r = buildSourceRowTokenGini(q, {
    generatedAt: GEN,
    minRows: 3,
  });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('row-token-gini: minMean display gate (strict <)', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 1),
    ql('2026-04-27T02:00:00.000Z', 'b', 50),
    ql('2026-04-27T03:00:00.000Z', 'b', 50),
    ql('2026-04-27T04:00:00.000Z', 'c', 100),
    ql('2026-04-27T05:00:00.000Z', 'c', 100),
  ];
  // means = a:1, b:50, c:100
  const r = buildSourceRowTokenGini(q, {
    generatedAt: GEN,
    minMean: 50,
  });
  // a (1<50) dropped; b (50 NOT <50) kept; c kept
  assert.equal(r.droppedBelowMinMean, 1);
  assert.equal(r.sources.length, 2);
});

test('row-token-gini: top cap with sort', () => {
  // gini(a) = 0 (all equal), gini(b) approx 0.33, gini(c) approx 0.5
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 10),
    ql('2026-04-27T01:00:00.000Z', 'a', 10),
    ql('2026-04-27T02:00:00.000Z', 'a', 10),
    ql('2026-04-27T00:00:00.000Z', 'b', 1),
    ql('2026-04-27T01:00:00.000Z', 'b', 2),
    ql('2026-04-27T02:00:00.000Z', 'b', 3),
    ql('2026-04-27T00:00:00.000Z', 'c', 0),
    ql('2026-04-27T01:00:00.000Z', 'c', 0),
    ql('2026-04-27T02:00:00.000Z', 'c', 100),
  ];
  const r = buildSourceRowTokenGini(q, {
    generatedAt: GEN,
    top: 2,
    sort: 'gini-desc',
  });
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
});

test('row-token-gini: sort gini-asc', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 10),
    ql('2026-04-27T01:00:00.000Z', 'a', 10),
    ql('2026-04-27T00:00:00.000Z', 'b', 1),
    ql('2026-04-27T01:00:00.000Z', 'b', 100),
  ];
  const r = buildSourceRowTokenGini(q, {
    generatedAt: GEN,
    sort: 'gini-asc',
  });
  assert.equal(r.sources[0]!.source, 'a'); // gini 0
  assert.equal(r.sources[1]!.source, 'b');
});

test('row-token-gini: sort unbiased-desc differs from gini-desc when n differs', () => {
  // a: small n -> bigger unbiased correction
  // a has gini = 0.5 (n=2), unbiased = 2/1 * 0.5 = 1.0
  // b has higher gini at 0.6 (constructed) but n=10 -> unbiased = 10/9 * 0.6 = 0.667
  // So sort by gini-desc puts b first; sort by unbiased-desc puts a first.
  const a = [
    ql('2026-04-27T00:00:00.000Z', 'a', 0),
    ql('2026-04-27T01:00:00.000Z', 'a', 100),
  ];
  // Build b with n=10 and gini 0.6
  // Use 5 zeros and 5 hundreds: x = [0,0,0,0,0,100,100,100,100,100]
  // S=500; weighted = 6*100+7*100+8*100+9*100+10*100 = 4000
  // G = (8000 - 11*500)/(10*500) = 2500/5000 = 0.5
  // unbiased = 10/9 * 0.5 = 0.5556
  const b: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    b.push(ql(`2026-04-27T0${i}:00:00.000Z`, 'b', 0));
  }
  for (let i = 5; i < 10; i += 1) {
    b.push(ql(`2026-04-27T${String(i).padStart(2, '0')}:00:00.000Z`, 'b', 100));
  }
  const q = [...a, ...b];
  const rGini = buildSourceRowTokenGini(q, {
    generatedAt: GEN,
    sort: 'gini-desc',
  });
  // a gini 0.5, b gini 0.5 -> tie -> source asc -> a first
  assert.equal(rGini.sources[0]!.source, 'a');
  const rUnb = buildSourceRowTokenGini(q, {
    generatedAt: GEN,
    sort: 'unbiased-desc',
  });
  // a unbiased 1.0, b unbiased ~0.556 -> a first
  assert.equal(rUnb.sources[0]!.source, 'a');
  assert.ok(rUnb.sources[0]!.giniUnbiased > rUnb.sources[1]!.giniUnbiased);
});

test('row-token-gini: sort by rows / mean / source', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 10),
    ql('2026-04-27T01:00:00.000Z', 'a', 20),
    ql('2026-04-27T02:00:00.000Z', 'a', 30),
    ql('2026-04-27T00:00:00.000Z', 'b', 100),
    ql('2026-04-27T01:00:00.000Z', 'b', 200),
  ];
  const rRows = buildSourceRowTokenGini(q, { generatedAt: GEN, sort: 'rows' });
  assert.equal(rRows.sources[0]!.source, 'a');
  const rMean = buildSourceRowTokenGini(q, { generatedAt: GEN, sort: 'mean' });
  assert.equal(rMean.sources[0]!.source, 'b');
  const rSrc = buildSourceRowTokenGini(q, { generatedAt: GEN, sort: 'source' });
  assert.equal(rSrc.sources[0]!.source, 'a');
});

test('row-token-gini: tie-break by source asc', () => {
  // Two sources with identical gini = 0.25 ([1,2,3,4]).
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'b', 1),
    ql('2026-04-27T01:00:00.000Z', 'b', 2),
    ql('2026-04-27T02:00:00.000Z', 'b', 3),
    ql('2026-04-27T03:00:00.000Z', 'b', 4),
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 2),
    ql('2026-04-27T02:00:00.000Z', 'a', 3),
    ql('2026-04-27T03:00:00.000Z', 'a', 4),
  ];
  const r = buildSourceRowTokenGini(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('row-token-gini: gini lies in [0, 1) for arbitrary positive samples', () => {
  // randomized-ish but deterministic
  const vals = [3, 7, 17, 31, 53, 89, 137, 211, 307, 401];
  const q = vals.map((v, i) =>
    ql(`2026-04-27T${String(i).padStart(2, '0')}:00:00.000Z`, 'a', v),
  );
  const r = buildSourceRowTokenGini(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(row.gini >= 0 && row.gini < 1, `gini=${row.gini}`);
  assert.ok(row.giniUnbiased >= 0 && row.giniUnbiased <= 1.001);
});

test('row-token-gini: degenerateMedian flagged when median = 0', () => {
  // 6 zeros + 4 hundreds: median = 0
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 0),
    ql('2026-04-27T01:00:00.000Z', 'a', 0),
    ql('2026-04-27T02:00:00.000Z', 'a', 0),
    ql('2026-04-27T03:00:00.000Z', 'a', 0),
    ql('2026-04-27T04:00:00.000Z', 'a', 0),
    ql('2026-04-27T05:00:00.000Z', 'a', 0),
    ql('2026-04-27T06:00:00.000Z', 'a', 100),
    ql('2026-04-27T07:00:00.000Z', 'a', 100),
    ql('2026-04-27T08:00:00.000Z', 'a', 100),
    ql('2026-04-27T09:00:00.000Z', 'a', 100),
  ];
  const r = buildSourceRowTokenGini(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.median, 0);
  assert.equal(row.degenerateMedian, true);
  assert.equal(row.meanToMedian, 0);
});

test('row-token-gini: report exposes all options in header fields', () => {
  const r = buildSourceRowTokenGini([], {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-30T00:00:00.000Z',
    source: 'sx',
    minRows: 5,
    minMean: 7.5,
    top: 3,
    sort: 'unbiased-asc',
  });
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00.000Z');
  assert.equal(r.source, 'sx');
  assert.equal(r.minRows, 5);
  assert.equal(r.minMean, 7.5);
  assert.equal(r.top, 3);
  assert.equal(r.sort, 'unbiased-asc');
});

test('row-token-gini: multi-source full pipeline integration', () => {
  // a: equal -> gini 0
  // b: [1,2,3,4] -> gini 0.25
  // c: [0,0,0,1000] -> gini 0.75
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 5),
    ql('2026-04-27T01:00:00.000Z', 'a', 5),
    ql('2026-04-27T02:00:00.000Z', 'a', 5),
    ql('2026-04-27T03:00:00.000Z', 'a', 5),
    ql('2026-04-27T00:00:00.000Z', 'b', 1),
    ql('2026-04-27T01:00:00.000Z', 'b', 2),
    ql('2026-04-27T02:00:00.000Z', 'b', 3),
    ql('2026-04-27T03:00:00.000Z', 'b', 4),
    ql('2026-04-27T00:00:00.000Z', 'c', 0),
    ql('2026-04-27T01:00:00.000Z', 'c', 0),
    ql('2026-04-27T02:00:00.000Z', 'c', 0),
    ql('2026-04-27T03:00:00.000Z', 'c', 1000),
  ];
  const r = buildSourceRowTokenGini(q, { generatedAt: GEN });
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 3);
  // gini-desc default: c first, then b, then a
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
  assert.equal(r.sources[2]!.source, 'a');
});
