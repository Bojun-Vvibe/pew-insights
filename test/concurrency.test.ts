import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildConcurrency } from '../src/concurrency.js';
import type { SessionLine } from '../src/types.js';

function sl(
  key: string,
  startedAt: string,
  endedAt: string,
  opts: Partial<SessionLine> = {},
): SessionLine {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  const dur = Math.max(0, Math.floor((end - start) / 1000));
  return {
    session_key: key,
    source: opts.source ?? 'test',
    kind: opts.kind ?? 'human',
    started_at: startedAt,
    last_message_at: endedAt,
    duration_seconds: opts.duration_seconds ?? dur,
    user_messages: opts.user_messages ?? 1,
    assistant_messages: opts.assistant_messages ?? 1,
    total_messages: opts.total_messages ?? 2,
    project_ref: opts.project_ref ?? '0000000000000000',
    model: opts.model ?? 'test-model',
    snapshot_at: opts.snapshot_at ?? endedAt,
  };
}

const GEN = '2026-04-24T12:00:00.000Z';

test('concurrency: rejects topN < 1 or non-integer', () => {
  assert.throws(() => buildConcurrency([], { topN: 0 }));
  assert.throws(() => buildConcurrency([], { topN: 2.5 }));
  assert.throws(() => buildConcurrency([], { topN: -1 }));
});

test('concurrency: rejects invalid since/until', () => {
  assert.throws(() => buildConcurrency([], { since: 'not-a-date' }));
  assert.throws(() => buildConcurrency([], { until: 'also-bad' }));
});

test('concurrency: empty input → zero peak, zero coverage', () => {
  const r = buildConcurrency([], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.peakConcurrency, 0);
  assert.equal(r.peakAt, null);
  assert.equal(r.peakSessions.length, 0);
  assert.equal(r.coverage, 0);
  assert.equal(r.averageConcurrency, 0);
  assert.equal(r.windowMs, 0);
});

test('concurrency: single session → peak=1, coverage=1.0', () => {
  const sessions = [sl('s1', '2026-04-24T10:00:00.000Z', '2026-04-24T11:00:00.000Z')];
  const r = buildConcurrency(sessions, { generatedAt: GEN });
  assert.equal(r.peakConcurrency, 1);
  assert.equal(r.peakAt, '2026-04-24T10:00:00.000Z');
  assert.equal(r.coverage, 1.0);
  assert.equal(r.averageConcurrency, 1.0);
  assert.equal(r.windowMs, 3600 * 1000);
  assert.equal(r.peakSessions.length, 1);
  assert.equal(r.peakSessions[0]!.sessionKey, 's1');
});

test('concurrency: two non-overlapping sessions → peak=1, never 2', () => {
  const sessions = [
    sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T11:00:00.000Z'),
    sl('b', '2026-04-24T12:00:00.000Z', '2026-04-24T13:00:00.000Z'),
  ];
  const r = buildConcurrency(sessions, { generatedAt: GEN });
  assert.equal(r.peakConcurrency, 1);
  // Window covers 10:00 → 13:00 = 3h. Active is 2h. Coverage = 2/3.
  assert.equal(r.windowMs, 3 * 3600 * 1000);
  assert(Math.abs(r.coverage - 2 / 3) < 1e-9);
});

test('concurrency: two overlapping sessions → peak=2 at the inner boundary', () => {
  const sessions = [
    sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T12:00:00.000Z'),
    sl('b', '2026-04-24T11:00:00.000Z', '2026-04-24T13:00:00.000Z'),
  ];
  const r = buildConcurrency(sessions, { generatedAt: GEN });
  assert.equal(r.peakConcurrency, 2);
  assert.equal(r.peakAt, '2026-04-24T11:00:00.000Z');
  assert.equal(r.peakDurationMs, 3600 * 1000);
  assert.deepEqual(
    r.peakSessions.map((s) => s.sessionKey),
    ['a', 'b'],
  );
});

test('concurrency: tie-break — close-before-open at the same timestamp does NOT count as overlap', () => {
  // a ends at exactly the same instant b starts → never 2 concurrent.
  const sessions = [
    sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T11:00:00.000Z'),
    sl('b', '2026-04-24T11:00:00.000Z', '2026-04-24T12:00:00.000Z'),
  ];
  const r = buildConcurrency(sessions, { generatedAt: GEN });
  assert.equal(r.peakConcurrency, 1, 'closing should be processed before opening at equal t');
  assert.equal(r.coverage, 1.0);
});

test('concurrency: peakSessions are sorted by session_key and capped at topN', () => {
  // Three sessions all overlapping in [11:00, 12:00).
  const sessions = [
    sl('zzz', '2026-04-24T10:00:00.000Z', '2026-04-24T13:00:00.000Z'),
    sl('aaa', '2026-04-24T11:00:00.000Z', '2026-04-24T12:30:00.000Z'),
    sl('mmm', '2026-04-24T11:00:00.000Z', '2026-04-24T12:00:00.000Z'),
  ];
  const r = buildConcurrency(sessions, { generatedAt: GEN, topN: 2 });
  assert.equal(r.peakConcurrency, 3);
  assert.equal(r.peakSessions.length, 2, 'capped at topN');
  assert.deepEqual(
    r.peakSessions.map((s) => s.sessionKey),
    ['aaa', 'mmm'],
    'sorted by session_key ascending',
  );
});

test('concurrency: numeric correctness of average and histogram', () => {
  // Window 0..4h. a:[0,3h), b:[1h,4h). Levels: 0..1h=1, 1..3h=2, 3..4h=1.
  const sessions = [
    sl('a', '2026-04-24T00:00:00.000Z', '2026-04-24T03:00:00.000Z'),
    sl('b', '2026-04-24T01:00:00.000Z', '2026-04-24T04:00:00.000Z'),
  ];
  const r = buildConcurrency(sessions, { generatedAt: GEN });
  assert.equal(r.windowMs, 4 * 3600 * 1000);
  // avg = (1*1 + 2*2 + 1*1) / 4 = 6/4 = 1.5
  assert(Math.abs(r.averageConcurrency - 1.5) < 1e-9);
  assert.equal(r.coverage, 1.0);
  const byLevel = new Map(r.histogram.map((b) => [b.level, b.totalMs]));
  assert.equal(byLevel.get(1), 2 * 3600 * 1000);
  assert.equal(byLevel.get(2), 2 * 3600 * 1000);
  assert.equal(byLevel.get(0) ?? 0, 0);
  assert.equal(r.peakDurationMs, 2 * 3600 * 1000);
});

test('concurrency: clipping — session starting before since is clipped, contribution preserved', () => {
  const sessions = [
    sl('a', '2026-04-24T08:00:00.000Z', '2026-04-24T12:00:00.000Z'),
  ];
  const r = buildConcurrency(sessions, {
    since: '2026-04-24T10:00:00.000Z',
    until: '2026-04-24T14:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.peakConcurrency, 1);
  // Active in [10:00, 12:00) = 2h of 4h window = 0.5 coverage.
  assert(Math.abs(r.coverage - 0.5) < 1e-9);
});

test('concurrency: session fully outside window is skipped', () => {
  const sessions = [
    sl('a', '2026-04-23T08:00:00.000Z', '2026-04-23T09:00:00.000Z'),
  ];
  const r = buildConcurrency(sessions, {
    since: '2026-04-24T00:00:00.000Z',
    until: '2026-04-24T12:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.skippedSessions, 1);
  assert.equal(r.peakConcurrency, 0);
});

test('concurrency: zero-length sessions (last_message_at == started_at, duration 0) are dropped', () => {
  const s: SessionLine = sl('z', '2026-04-24T10:00:00.000Z', '2026-04-24T10:00:00.000Z');
  s.duration_seconds = 0;
  const r = buildConcurrency([s], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.peakConcurrency, 0);
});

test('concurrency: duration_seconds extends end past last_message_at when needed', () => {
  // last_message_at == started_at, but duration says 1h.
  const s = sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T10:00:00.000Z');
  s.duration_seconds = 3600;
  const r = buildConcurrency([s], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.peakConcurrency, 1);
  assert.equal(r.windowMs, 3600 * 1000);
});

test('concurrency: identical intervals → peak = 2, both surfaced', () => {
  const sessions = [
    sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T11:00:00.000Z'),
    sl('b', '2026-04-24T10:00:00.000Z', '2026-04-24T11:00:00.000Z'),
  ];
  const r = buildConcurrency(sessions, { generatedAt: GEN });
  assert.equal(r.peakConcurrency, 2);
  assert.equal(r.peakDurationMs, 3600 * 1000);
  assert.deepEqual(
    r.peakSessions.map((s) => s.sessionKey).sort(),
    ['a', 'b'],
  );
});

test('concurrency: histogram fractions sum to ~1.0', () => {
  const sessions = [
    sl('a', '2026-04-24T00:00:00.000Z', '2026-04-24T03:00:00.000Z'),
    sl('b', '2026-04-24T02:00:00.000Z', '2026-04-24T05:00:00.000Z'),
    sl('c', '2026-04-24T04:00:00.000Z', '2026-04-24T06:00:00.000Z'),
  ];
  const r = buildConcurrency(sessions, { generatedAt: GEN });
  const sum = r.histogram.reduce((a, b) => a + b.fraction, 0);
  assert(Math.abs(sum - 1.0) < 1e-9, `histogram fractions should sum to 1, got ${sum}`);
});

test('concurrency: peak spanning multiple disjoint segments accumulates duration', () => {
  // Two separate overlap pockets, each at peak=2 for 30 min.
  const sessions = [
    sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T10:30:00.000Z'),
    sl('b', '2026-04-24T10:00:00.000Z', '2026-04-24T10:30:00.000Z'),
    sl('c', '2026-04-24T11:00:00.000Z', '2026-04-24T11:30:00.000Z'),
    sl('d', '2026-04-24T11:00:00.000Z', '2026-04-24T11:30:00.000Z'),
  ];
  const r = buildConcurrency(sessions, { generatedAt: GEN });
  assert.equal(r.peakConcurrency, 2);
  // Note: peakDurationMs starts counting after the first peak instant — the segment ending at the peak is recorded under the previous level.
  // First peak segment: [10:00, 10:30) = 30 min.
  // Second peak segment: [11:00, 11:30) = 30 min.
  // Total at level=2 in histogram should be 60 min.
  const lvl2 = r.histogram.find((b) => b.level === 2);
  assert.ok(lvl2);
  assert.equal(lvl2!.totalMs, 60 * 60 * 1000);
});

test('concurrency: p95 — sustained level dominates over rare tall spike', () => {
  // 100h window. 99h at level=1, then 1h at level=2.
  // Cumulative: level 1 → 99%, so p95 = 1 (not 2).
  const sessions = [
    sl('a', '2026-04-01T00:00:00.000Z', '2026-04-05T04:00:00.000Z'), // 100h
    sl('b', '2026-04-05T03:00:00.000Z', '2026-04-05T04:00:00.000Z'), // last 1h
  ];
  const r = buildConcurrency(sessions, { generatedAt: GEN });
  assert.equal(r.peakConcurrency, 2);
  assert.equal(r.p95Concurrency, 1, 'rare spike should not move p95');
});

test('concurrency: p95 — when peak sustained for >5%, p95 reaches peak', () => {
  // 10h window: 5h at level=1, 5h at level=2. p95 must be 2.
  const sessions = [
    sl('a', '2026-04-01T00:00:00.000Z', '2026-04-01T10:00:00.000Z'),
    sl('b', '2026-04-01T05:00:00.000Z', '2026-04-01T10:00:00.000Z'),
  ];
  const r = buildConcurrency(sessions, { generatedAt: GEN });
  assert.equal(r.peakConcurrency, 2);
  assert.equal(r.p95Concurrency, 2);
});

test('concurrency: p95 = 0 on empty input', () => {
  const r = buildConcurrency([], { generatedAt: GEN });
  assert.equal(r.p95Concurrency, 0);
});
