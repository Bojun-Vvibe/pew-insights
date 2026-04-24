import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceMix } from '../src/sourcemix.js';
import type { SessionLine } from '../src/types.js';

function sl(startedAt: string, source: string, opts: Partial<SessionLine> = {}): SessionLine {
  return {
    session_key: opts.session_key ?? `s-${startedAt}-${source}`,
    source,
    kind: opts.kind ?? 'human',
    started_at: startedAt,
    last_message_at: opts.last_message_at ?? startedAt,
    duration_seconds: opts.duration_seconds ?? 60,
    user_messages: opts.user_messages ?? 1,
    assistant_messages: opts.assistant_messages ?? 1,
    total_messages: opts.total_messages ?? 2,
    project_ref: opts.project_ref ?? '0000000000000000',
    model: opts.model ?? 'm1',
    snapshot_at: opts.snapshot_at ?? startedAt,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

test('source-mix: rejects bad unit', () => {
  // @ts-expect-error testing runtime validation
  assert.throws(() => buildSourceMix([], { unit: 'fortnight' }));
});

test('source-mix: rejects bad top', () => {
  assert.throws(() => buildSourceMix([], { top: -1 }));
  assert.throws(() => buildSourceMix([], { top: 1.5 }));
  assert.throws(() => buildSourceMix([], { top: Number.NaN }));
});

test('source-mix: rejects bad since/until', () => {
  assert.throws(() => buildSourceMix([], { since: 'no' }));
  assert.throws(() => buildSourceMix([], { until: 'no' }));
});

test('source-mix: empty input → empty report', () => {
  const r = buildSourceMix([], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.buckets.length, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.unit, 'day');
});

test('source-mix: bucketing by day', () => {
  const r = buildSourceMix(
    [
      sl('2026-04-20T01:00:00.000Z', 'claude-code'),
      sl('2026-04-20T22:30:00.000Z', 'opencode'),
      sl('2026-04-20T23:59:59.999Z', 'claude-code'),
      sl('2026-04-21T00:00:00.000Z', 'codex'),
    ],
    { unit: 'day', generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 4);
  assert.equal(r.buckets.length, 2);
  assert.equal(r.buckets[0]!.bucket, '2026-04-20');
  assert.equal(r.buckets[0]!.totalSessions, 3);
  assert.equal(r.buckets[0]!.modalSource, 'claude-code');
  assert.ok(Math.abs(r.buckets[0]!.modalShare - 2 / 3) < 1e-9);
  assert.equal(r.buckets[1]!.bucket, '2026-04-21');
  assert.equal(r.buckets[1]!.totalSessions, 1);
  assert.equal(r.buckets[1]!.modalSource, 'codex');
});

test('source-mix: bucketing by week (UTC Monday)', () => {
  // 2026-04-20 is a Monday (UTC). 2026-04-26 Sunday → same week.
  // 2026-04-27 Monday → next week.
  const r = buildSourceMix(
    [
      sl('2026-04-20T03:00:00.000Z', 'claude-code'),
      sl('2026-04-26T23:00:00.000Z', 'opencode'),
      sl('2026-04-27T00:00:00.000Z', 'codex'),
    ],
    { unit: 'week', generatedAt: GEN },
  );
  assert.equal(r.buckets.length, 2);
  assert.equal(r.buckets[0]!.bucket, '2026-04-20');
  assert.equal(r.buckets[0]!.totalSessions, 2);
  assert.equal(r.buckets[1]!.bucket, '2026-04-27');
  assert.equal(r.buckets[1]!.totalSessions, 1);
});

test('source-mix: bucketing by month', () => {
  const r = buildSourceMix(
    [
      sl('2026-03-31T23:00:00.000Z', 'claude-code'),
      sl('2026-04-01T00:00:00.000Z', 'opencode'),
      sl('2026-04-15T12:00:00.000Z', 'opencode'),
    ],
    { unit: 'month', generatedAt: GEN },
  );
  assert.equal(r.buckets.length, 2);
  assert.equal(r.buckets[0]!.bucket, '2026-03-01');
  assert.equal(r.buckets[1]!.bucket, '2026-04-01');
  assert.equal(r.buckets[1]!.totalSessions, 2);
});

test('source-mix: window filter via since/until', () => {
  const r = buildSourceMix(
    [
      sl('2026-04-19T12:00:00.000Z', 'claude-code'),
      sl('2026-04-20T12:00:00.000Z', 'claude-code'),
      sl('2026-04-21T12:00:00.000Z', 'opencode'),
      sl('2026-04-22T12:00:00.000Z', 'codex'),
    ],
    {
      since: '2026-04-20T00:00:00.000Z',
      until: '2026-04-22T00:00:00.000Z',
      generatedAt: GEN,
    },
  );
  assert.equal(r.consideredSessions, 2);
  assert.equal(r.buckets.length, 2);
  assert.deepEqual(
    r.buckets.map((b) => b.bucket),
    ['2026-04-20', '2026-04-21'],
  );
});

test('source-mix: invalid started_at counted as droppedInvalid', () => {
  const r = buildSourceMix(
    [
      sl('2026-04-20T00:00:00.000Z', 'claude-code'),
      sl('not-a-date', 'opencode'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.droppedInvalid, 1);
});

test('source-mix: empty source string folded into "unknown"', () => {
  const r = buildSourceMix(
    [sl('2026-04-20T00:00:00.000Z', '' as unknown as string)],
    { generatedAt: GEN },
  );
  assert.equal(r.buckets[0]!.shares[0]!.source, 'unknown');
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('source-mix: shares within a bucket sum to 1', () => {
  const r = buildSourceMix(
    [
      sl('2026-04-20T00:00:00.000Z', 'a'),
      sl('2026-04-20T01:00:00.000Z', 'b'),
      sl('2026-04-20T02:00:00.000Z', 'c'),
      sl('2026-04-20T03:00:00.000Z', 'a'),
    ],
    { generatedAt: GEN },
  );
  const total = r.buckets[0]!.shares.reduce((acc, s) => acc + s.share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('source-mix: buckets sorted ascending by bucketStart', () => {
  const r = buildSourceMix(
    [
      sl('2026-04-22T00:00:00.000Z', 'a'),
      sl('2026-04-20T00:00:00.000Z', 'a'),
      sl('2026-04-21T00:00:00.000Z', 'a'),
    ],
    { generatedAt: GEN },
  );
  assert.deepEqual(
    r.buckets.map((b) => b.bucket),
    ['2026-04-20', '2026-04-21', '2026-04-22'],
  );
});

test('source-mix: top=N folds remaining into "other"', () => {
  const r = buildSourceMix(
    [
      sl('2026-04-20T00:00:00.000Z', 'a'),
      sl('2026-04-20T01:00:00.000Z', 'a'),
      sl('2026-04-20T02:00:00.000Z', 'a'),
      sl('2026-04-20T03:00:00.000Z', 'b'),
      sl('2026-04-20T04:00:00.000Z', 'b'),
      sl('2026-04-20T05:00:00.000Z', 'c'),
      sl('2026-04-20T06:00:00.000Z', 'd'),
    ],
    { top: 2, generatedAt: GEN },
  );
  // Top 2 = a (3), b (2). c (1) + d (1) → other (2).
  const sourceMap = new Map(r.sources.map((s) => [s.source, s.count]));
  assert.equal(sourceMap.get('a'), 3);
  assert.equal(sourceMap.get('b'), 2);
  assert.equal(sourceMap.get('other'), 2);
  assert.equal(sourceMap.has('c'), false);
  assert.equal(sourceMap.has('d'), false);

  const bucketShares = new Map(r.buckets[0]!.shares.map((s) => [s.source, s.count]));
  assert.equal(bucketShares.get('other'), 2);
});

test('source-mix: top=0 keeps every source', () => {
  const r = buildSourceMix(
    [
      sl('2026-04-20T00:00:00.000Z', 'a'),
      sl('2026-04-20T01:00:00.000Z', 'b'),
      sl('2026-04-20T02:00:00.000Z', 'c'),
    ],
    { top: 0, generatedAt: GEN },
  );
  assert.equal(r.sources.length, 3);
  assert.equal(
    r.sources.find((s) => s.source === 'other'),
    undefined,
  );
});

test('source-mix: top larger than distinct sources → no folding', () => {
  const r = buildSourceMix(
    [
      sl('2026-04-20T00:00:00.000Z', 'a'),
      sl('2026-04-20T01:00:00.000Z', 'b'),
    ],
    { top: 10, generatedAt: GEN },
  );
  assert.equal(r.sources.length, 2);
  assert.equal(
    r.sources.find((s) => s.source === 'other'),
    undefined,
  );
});
