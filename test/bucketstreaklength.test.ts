import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildBucketStreakLength } from '../src/bucketstreaklength.js';
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

test('bucket-streak-length: rejects bad minBuckets', () => {
  assert.throws(() => buildBucketStreakLength([], { minBuckets: -1 }));
  assert.throws(() => buildBucketStreakLength([], { minBuckets: 1.5 }));
});

test('bucket-streak-length: rejects bad bucketWidthMs', () => {
  assert.throws(() => buildBucketStreakLength([], { bucketWidthMs: 0 }));
  assert.throws(() => buildBucketStreakLength([], { bucketWidthMs: -3600000 }));
  assert.throws(() => buildBucketStreakLength([], { bucketWidthMs: 1.5 }));
});

test('bucket-streak-length: rejects bad since/until', () => {
  assert.throws(() => buildBucketStreakLength([], { since: 'no' }));
  assert.throws(() => buildBucketStreakLength([], { until: 'nope' }));
});

// ---- empty / shape --------------------------------------------------------

test('bucket-streak-length: empty input -> empty report with safe defaults', () => {
  const r = buildBucketStreakLength([], { generatedAt: GEN });
  assert.equal(r.totalModels, 0);
  assert.equal(r.totalActiveBuckets, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.models.length, 0);
  assert.equal(r.bucketWidthMs, HOUR); // fallback
  assert.equal(r.bucketWidthInferred, true);
  assert.equal(r.generatedAt, GEN);
});

// ---- single bucket --------------------------------------------------------

test('bucket-streak-length: single-bucket model -> longest=1, streaks=1', () => {
  const r = buildBucketStreakLength(
    [ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 100)],
    { generatedAt: GEN, bucketWidthMs: HOUR },
  );
  assert.equal(r.models.length, 1);
  const row = r.models[0]!;
  assert.equal(row.model, 'gpt-5');
  assert.equal(row.activeBuckets, 1);
  assert.equal(row.streakCount, 1);
  assert.equal(row.longestStreak, 1);
  assert.equal(row.meanStreakLength, 1);
  assert.equal(row.tokens, 100);
  assert.equal(row.longestStreakStart, '2026-04-20T00:00:00.000Z');
  assert.equal(row.longestStreakEnd, '2026-04-20T00:00:00.000Z');
});

// ---- contiguous streak ----------------------------------------------------

test('bucket-streak-length: 4 contiguous hourly buckets -> single streak of 4', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T01:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T02:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T03:00:00.000Z', 'a', 'gpt-5', 1),
  ];
  const r = buildBucketStreakLength(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
  });
  const row = r.models[0]!;
  assert.equal(row.activeBuckets, 4);
  assert.equal(row.streakCount, 1);
  assert.equal(row.longestStreak, 4);
  assert.equal(row.meanStreakLength, 4);
  assert.equal(row.longestStreakStart, '2026-04-20T00:00:00.000Z');
  assert.equal(row.longestStreakEnd, '2026-04-20T03:00:00.000Z');
});

// ---- with gap -------------------------------------------------------------

test('bucket-streak-length: gap splits into two streaks; longest wins', () => {
  // Streak A: 00, 01, 02 (len 3); gap; Streak B: 10, 11 (len 2)
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T01:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T02:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T10:00:00.000Z', 'a', 'gpt-5', 1),
    ql('2026-04-20T11:00:00.000Z', 'a', 'gpt-5', 1),
  ];
  const r = buildBucketStreakLength(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
  });
  const row = r.models[0]!;
  assert.equal(row.activeBuckets, 5);
  assert.equal(row.streakCount, 2);
  assert.equal(row.longestStreak, 3);
  assert.equal(row.meanStreakLength, 2.5);
  assert.equal(row.longestStreakStart, '2026-04-20T00:00:00.000Z');
  assert.equal(row.longestStreakEnd, '2026-04-20T02:00:00.000Z');
});

// ---- multi-model + sort ---------------------------------------------------

test('bucket-streak-length: multi-model sorted by longestStreak desc, model asc tiebreak', () => {
  const rows = [
    // gpt-A: streak of 2
    ql('2026-04-20T00:00:00.000Z', 's', 'gpt-A', 1),
    ql('2026-04-20T01:00:00.000Z', 's', 'gpt-A', 1),
    // gpt-B: streak of 5
    ql('2026-04-20T00:00:00.000Z', 's', 'gpt-B', 1),
    ql('2026-04-20T01:00:00.000Z', 's', 'gpt-B', 1),
    ql('2026-04-20T02:00:00.000Z', 's', 'gpt-B', 1),
    ql('2026-04-20T03:00:00.000Z', 's', 'gpt-B', 1),
    ql('2026-04-20T04:00:00.000Z', 's', 'gpt-B', 1),
    // gpt-C: streak of 2 (tie with A)
    ql('2026-04-20T00:00:00.000Z', 's', 'gpt-C', 1),
    ql('2026-04-20T01:00:00.000Z', 's', 'gpt-C', 1),
  ];
  const r = buildBucketStreakLength(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
  });
  assert.equal(r.models.length, 3);
  assert.equal(r.models[0]!.model, 'gpt-b'); // longest=5
  assert.equal(r.models[0]!.longestStreak, 5);
  // A and C tie at 2, A < C lex
  assert.equal(r.models[1]!.model, 'gpt-a');
  assert.equal(r.models[2]!.model, 'gpt-c');
});

// ---- since / until --------------------------------------------------------

test('bucket-streak-length: since/until window clipping', () => {
  const rows = [
    ql('2026-04-19T23:00:00.000Z', 's', 'm', 1), // before
    ql('2026-04-20T00:00:00.000Z', 's', 'm', 1), // in
    ql('2026-04-20T01:00:00.000Z', 's', 'm', 1), // in
    ql('2026-04-20T05:00:00.000Z', 's', 'm', 1), // out (>= until)
  ];
  const r = buildBucketStreakLength(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-20T05:00:00.000Z',
  });
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.activeBuckets, 2);
  assert.equal(r.models[0]!.longestStreak, 2);
});

// ---- source filter --------------------------------------------------------

test('bucket-streak-length: source filter excludes other sources', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'keep', 'm', 1),
    ql('2026-04-20T01:00:00.000Z', 'keep', 'm', 1),
    ql('2026-04-20T00:00:00.000Z', 'drop', 'm', 1),
    ql('2026-04-20T03:00:00.000Z', 'drop', 'm', 1),
  ];
  const r = buildBucketStreakLength(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
    source: 'keep',
  });
  assert.equal(r.source, 'keep');
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.activeBuckets, 2);
  assert.equal(r.models[0]!.longestStreak, 2);
});

// ---- minBuckets -----------------------------------------------------------

test('bucket-streak-length: minBuckets filter hides sparse models, totals reflect full population', () => {
  const rows = [
    // sparse: 1 bucket
    ql('2026-04-20T00:00:00.000Z', 's', 'sparse', 100),
    // dense: 3 buckets
    ql('2026-04-20T00:00:00.000Z', 's', 'dense', 10),
    ql('2026-04-20T01:00:00.000Z', 's', 'dense', 10),
    ql('2026-04-20T02:00:00.000Z', 's', 'dense', 10),
  ];
  const r = buildBucketStreakLength(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
    minBuckets: 2,
  });
  assert.equal(r.droppedSparseModels, 1);
  assert.equal(r.totalActiveBuckets, 4); // includes sparse
  assert.equal(r.totalTokens, 130);
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.model, 'dense');
});

// ---- dropped counters -----------------------------------------------------

test('bucket-streak-length: drops bad hour_start and zero-tokens rows', () => {
  const rows = [
    ql('garbage', 's', 'm', 1),
    ql('2026-04-20T00:00:00.000Z', 's', 'm', 0), // zero tokens
    ql('2026-04-20T01:00:00.000Z', 's', 'm', -5), // negative
    ql('2026-04-20T02:00:00.000Z', 's', 'm', 50),
  ];
  const r = buildBucketStreakLength(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.activeBuckets, 1);
  assert.equal(r.models[0]!.tokens, 50);
});

// ---- duplicate buckets accumulate tokens ----------------------------------

test('bucket-streak-length: duplicate hour_start rows for same model accumulate tokens, count as 1 bucket', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 's1', 'm', 100),
    ql('2026-04-20T00:00:00.000Z', 's2', 'm', 200), // same bucket, diff source
    ql('2026-04-20T01:00:00.000Z', 's1', 'm', 50),
  ];
  const r = buildBucketStreakLength(rows, {
    generatedAt: GEN,
    bucketWidthMs: HOUR,
  });
  assert.equal(r.models.length, 1);
  const row = r.models[0]!;
  assert.equal(row.activeBuckets, 2);
  assert.equal(row.tokens, 350);
  assert.equal(row.longestStreak, 2);
  assert.equal(row.streakCount, 1);
});

// ---- bucket-width inference ----------------------------------------------

test('bucket-streak-length: bucket-width inferred as smallest positive gap (30m)', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 's', 'm', 1),
    ql('2026-04-20T00:30:00.000Z', 's', 'm', 1),
    ql('2026-04-20T01:00:00.000Z', 's', 'm', 1),
    // big jump, should split
    ql('2026-04-20T05:00:00.000Z', 's', 'm', 1),
  ];
  const r = buildBucketStreakLength(rows, { generatedAt: GEN });
  assert.equal(r.bucketWidthMs, 30 * 60_000);
  assert.equal(r.bucketWidthInferred, true);
  const row = r.models[0]!;
  assert.equal(row.activeBuckets, 4);
  assert.equal(row.streakCount, 2);
  assert.equal(row.longestStreak, 3);
});
