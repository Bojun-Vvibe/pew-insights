import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildBucketGapDistribution } from '../src/bucketgapdistribution.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hourStart: string,
  source: string,
  model: string,
  totalTokens: number,
): QueueLine {
  return {
    source,
    model,
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: totalTokens,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';
const HOUR = 3_600_000;

// ---- option validation ----------------------------------------------------

test('bucket-gap-distribution: rejects bad minGaps', () => {
  assert.throws(() => buildBucketGapDistribution([], { minGaps: -1 }));
  assert.throws(() => buildBucketGapDistribution([], { minGaps: 1.5 }));
});

test('bucket-gap-distribution: rejects bad top', () => {
  assert.throws(() => buildBucketGapDistribution([], { top: 0 }));
  assert.throws(() => buildBucketGapDistribution([], { top: -1 }));
  assert.throws(() => buildBucketGapDistribution([], { top: 1.5 }));
});

test('bucket-gap-distribution: rejects bad bucketWidthMs', () => {
  assert.throws(() => buildBucketGapDistribution([], { bucketWidthMs: 0 }));
  assert.throws(() =>
    buildBucketGapDistribution([], { bucketWidthMs: -3600000 }),
  );
});

test('bucket-gap-distribution: rejects bad since/until', () => {
  assert.throws(() => buildBucketGapDistribution([], { since: 'no' }));
  assert.throws(() => buildBucketGapDistribution([], { until: 'nope' }));
});

test('bucket-gap-distribution: rejects bad sort', () => {
  // @ts-expect-error - intentionally invalid sort
  assert.throws(() => buildBucketGapDistribution([], { sort: 'bogus' }));
});

// ---- empty / shape --------------------------------------------------------

test('bucket-gap-distribution: empty input -> empty report with safe defaults', () => {
  const r = buildBucketGapDistribution([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalActiveBuckets, 0);
  assert.equal(r.totalGaps, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.bucketWidthMs, HOUR);
  assert.equal(r.bucketWidthInferred, true);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.sort, 'tokens');
  assert.equal(r.minGaps, 0);
  assert.equal(r.top, null);
});

// ---- single bucket --------------------------------------------------------

test('bucket-gap-distribution: single-bucket source -> gapCount 0, sentinel zeros', () => {
  const r = buildBucketGapDistribution(
    [ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 100)],
    { generatedAt: GEN, bucketWidthMs: HOUR },
  );
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'a');
  assert.equal(row.activeBuckets, 1);
  assert.equal(row.gapCount, 0);
  assert.equal(row.minGap, 0);
  assert.equal(row.maxGap, 0);
  assert.equal(row.contiguousShare, 0);
  assert.equal(row.tokens, 100);
});

test('bucket-gap-distribution: minGaps=1 hides single-bucket source', () => {
  const r = buildBucketGapDistribution(
    [ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 100)],
    { generatedAt: GEN, bucketWidthMs: HOUR, minGaps: 1 },
  );
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

// ---- contiguous run -------------------------------------------------------

test('bucket-gap-distribution: 4 contiguous hourly buckets -> 3 gaps all =1, contigShare 1', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T01:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T02:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T03:00:00.000Z', 'a', 'gpt-5', 1),
  ];
  const r = buildBucketGapDistribution(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
  });
  const row = r.sources[0]!;
  assert.equal(row.activeBuckets, 4);
  assert.equal(row.gapCount, 3);
  assert.equal(row.minGap, 1);
  assert.equal(row.p50Gap, 1);
  assert.equal(row.p90Gap, 1);
  assert.equal(row.maxGap, 1);
  assert.equal(row.meanGap, 1);
  assert.equal(row.contiguousGaps, 3);
  assert.equal(row.contiguousShare, 1);
});

// ---- mixed gap distribution -----------------------------------------------

test('bucket-gap-distribution: mixed gaps yield correct percentiles + contiguous share', () => {
  // Buckets at hours 0,1,2,5,10,11 -> gaps in widths: 1,1,3,5,1
  // sorted: 1,1,1,3,5
  // n=5, p50 rank=ceil(0.5*5)=3 -> 1; p90 rank=ceil(4.5)=5 -> 5; p99=5
  // contiguous=3, share=3/5=0.6, mean=(1+1+3+5+1)/5=11/5=2.2
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T01:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T02:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T05:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T10:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T11:00:00.000Z', 'a', 'gpt-5', 1),
  ];
  const r = buildBucketGapDistribution(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
  });
  const row = r.sources[0]!;
  assert.equal(row.activeBuckets, 6);
  assert.equal(row.gapCount, 5);
  assert.equal(row.minGap, 1);
  assert.equal(row.p50Gap, 1);
  assert.equal(row.p90Gap, 5);
  assert.equal(row.p99Gap, 5);
  assert.equal(row.maxGap, 5);
  assert.equal(row.contiguousGaps, 3);
  assert.equal(row.contiguousShare, 0.6);
  assert.equal(Number(row.meanGap.toFixed(4)), 2.2);
});

// ---- bucket-width inference ----------------------------------------------

test('bucket-gap-distribution: bucket-width inferred from smallest positive gap (30m wins over 60m)', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T00:30:00.000Z', 'a', 'gpt-5', 1), // 30m gap globally
    ql('2026-04-20T02:00:00.000Z', 'b', 'gpt-5', 1),
    ql('2026-04-20T03:00:00.000Z', 'b', 'gpt-5', 1), // 60m
  ];
  const r = buildBucketGapDistribution(rows, { generatedAt: GEN });
  assert.equal(r.bucketWidthMs, 30 * 60 * 1000);
  assert.equal(r.bucketWidthInferred, true);
  // source 'b' -> 1 gap of 60m / 30m = 2 widths
  const b = r.sources.find((s) => s.source === 'b')!;
  assert.equal(b.gapCount, 1);
  assert.equal(b.minGap, 2);
  assert.equal(b.maxGap, 2);
  assert.equal(b.contiguousShare, 0);
});

// ---- model filter ---------------------------------------------------------

test('bucket-gap-distribution: model filter drops non-matching rows', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T01:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T02:00:00.000Z', 'a', 'claude-sonnet', 1),
  ];
  const r = buildBucketGapDistribution(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
    model: 'gpt-5',
  });
  assert.equal(r.droppedModelFilter, 1);
  const row = r.sources[0]!;
  assert.equal(row.activeBuckets, 2);
  assert.equal(row.gapCount, 1);
  assert.equal(row.minGap, 1);
});

// ---- since / until --------------------------------------------------------

test('bucket-gap-distribution: since/until window narrows the timeline', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T01:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T05:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T06:00:00.000Z', 'a', 'gpt-5', 1),
  ];
  const r = buildBucketGapDistribution(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
    since: '2026-04-20T05:00:00.000Z',
  });
  const row = r.sources[0]!;
  assert.equal(row.activeBuckets, 2);
  assert.equal(row.gapCount, 1);
  assert.equal(row.maxGap, 1);
});

// ---- zero / invalid token rows -------------------------------------------

test('bucket-gap-distribution: zero-token rows excluded; not counted toward activeBuckets', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T01:00:00.000Z', 'a', 'gpt-5', 0),
    ql('2026-04-20T02:00:00.000Z', 'a', 'gpt-5', 1),
  ];
  const r = buildBucketGapDistribution(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
  });
  assert.equal(r.droppedZeroTokens, 1);
  const row = r.sources[0]!;
  assert.equal(row.activeBuckets, 2);
  assert.equal(row.gapCount, 1);
  // 0->2h with 1h width = 2 widths gap (the middle bucket was dropped)
  assert.equal(row.maxGap, 2);
});

// ---- sort modes -----------------------------------------------------------

test('bucket-gap-distribution: sort=max puts worst-tail first', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'small-tail', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'small-tail', 'gpt-5', 100),
    ql('2026-04-20T02:00:00.000Z', 'small-tail', 'gpt-5', 100),
    ql('2026-04-20T00:00:00.000Z', 'big-tail', 'gpt-5', 1),
    ql('2026-04-20T20:00:00.000Z', 'big-tail', 'gpt-5', 1),
  ];
  const r = buildBucketGapDistribution(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
    sort: 'max',
  });
  assert.equal(r.sources[0]!.source, 'big-tail');
  assert.equal(r.sources[0]!.maxGap, 20);
  assert.equal(r.sources[1]!.source, 'small-tail');
});

test('bucket-gap-distribution: sort=contiguous puts most-contiguous first', () => {
  const rows = [
    // src "spread" -> 3 gaps all of size 5
    ql('2026-04-20T00:00:00.000Z', 'spread', 'gpt-5', 1),
    ql('2026-04-20T05:00:00.000Z', 'spread', 'gpt-5', 1),
    ql('2026-04-20T10:00:00.000Z', 'spread', 'gpt-5', 1),
    ql('2026-04-20T15:00:00.000Z', 'spread', 'gpt-5', 1),
    // src "tight" -> 3 gaps all of size 1
    ql('2026-04-20T00:00:00.000Z', 'tight', 'gpt-5', 1),
    ql('2026-04-20T01:00:00.000Z', 'tight', 'gpt-5', 1),
    ql('2026-04-20T02:00:00.000Z', 'tight', 'gpt-5', 1),
    ql('2026-04-20T03:00:00.000Z', 'tight', 'gpt-5', 1),
  ];
  const r = buildBucketGapDistribution(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
    sort: 'contiguous',
  });
  assert.equal(r.sources[0]!.source, 'tight');
  assert.equal(r.sources[0]!.contiguousShare, 1);
  assert.equal(r.sources[1]!.source, 'spread');
  assert.equal(r.sources[1]!.contiguousShare, 0);
});

// ---- top cap --------------------------------------------------------------

test('bucket-gap-distribution: top caps displayed sources, surfaces droppedBelowTopCap', () => {
  const rows: QueueLine[] = [];
  for (const src of ['a', 'b', 'c', 'd']) {
    rows.push(ql('2026-04-20T00:00:00.000Z', src, 'gpt-5', 1));
    rows.push(ql('2026-04-20T01:00:00.000Z', src, 'gpt-5', 1));
  }
  const r = buildBucketGapDistribution(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
    top: 2,
  });
  assert.equal(r.totalSources, 4);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
  assert.equal(r.top, 2);
});

// ---- bad hour_start -------------------------------------------------------

test('bucket-gap-distribution: bad hour_start rows surface as droppedInvalidHourStart', () => {
  const rows: QueueLine[] = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 1),
    ql('not-a-date', 'a', 'gpt-5', 1),
    ql('2026-04-20T01:00:00.000Z', 'a', 'gpt-5', 1),
  ];
  const r = buildBucketGapDistribution(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  const row = r.sources[0]!;
  assert.equal(row.activeBuckets, 2);
  assert.equal(row.gapCount, 1);
});
