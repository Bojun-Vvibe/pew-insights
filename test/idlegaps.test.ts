import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildIdleGaps, DEFAULT_IDLE_GAP_EDGES_SECONDS } from '../src/idlegaps.js';
import type { SessionLine } from '../src/types.js';

function sl(
  sessionKey: string,
  startedAt: string,
  snapshotAt: string,
  opts: Partial<SessionLine> = {},
): SessionLine {
  return {
    session_key: sessionKey,
    source: opts.source ?? 'src1',
    kind: opts.kind ?? 'human',
    started_at: startedAt,
    last_message_at: opts.last_message_at ?? snapshotAt,
    duration_seconds: opts.duration_seconds ?? 100,
    user_messages: opts.user_messages ?? 5,
    assistant_messages: opts.assistant_messages ?? 5,
    total_messages: opts.total_messages ?? 10,
    project_ref: opts.project_ref ?? '0000000000000000',
    model: opts.model ?? 'm1',
    snapshot_at: snapshotAt,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

test('idle-gaps: rejects bad by', () => {
  // @ts-expect-error testing runtime validation
  assert.throws(() => buildIdleGaps([], { by: 'bogus' }));
});

test('idle-gaps: rejects bad minGapSeconds', () => {
  assert.throws(() => buildIdleGaps([], { minGapSeconds: -1 }));
  assert.throws(() => buildIdleGaps([], { minGapSeconds: Number.NaN }));
});

test('idle-gaps: rejects bad since/until', () => {
  assert.throws(() => buildIdleGaps([], { since: 'not-an-iso' }));
  assert.throws(() => buildIdleGaps([], { until: 'not-an-iso' }));
});

test('idle-gaps: rejects bad edges', () => {
  assert.throws(() => buildIdleGaps([], { edges: [] }));
  assert.throws(() => buildIdleGaps([], { edges: [-1] }));
  assert.throws(() => buildIdleGaps([], { edges: [60, 30] }));
  assert.throws(() => buildIdleGaps([], { edges: [60, 60] }));
});

test('idle-gaps: empty input → empty report', () => {
  const r = buildIdleGaps([], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.totalGaps, 0);
  assert.equal(r.singleSnapshotSessions, 0);
  assert.equal(r.distributions.length, 1);
  assert.equal(r.distributions[0]!.modalBinIndex, -1);
  assert.equal(r.distributions[0]!.bins.length, DEFAULT_IDLE_GAP_EDGES_SECONDS.length + 1);
});

test('idle-gaps: single-snapshot session is counted but contributes no gaps', () => {
  const r = buildIdleGaps(
    [sl('k1', '2026-04-25T10:00:00Z', '2026-04-25T10:00:00Z')],
    { generatedAt: GEN },
  );
  assert.equal(r.singleSnapshotSessions, 1);
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.totalGaps, 0);
});

test('idle-gaps: two snapshots → one gap, ordered by snapshot_at', () => {
  const r = buildIdleGaps(
    [
      sl('k1', '2026-04-25T10:00:00Z', '2026-04-25T10:05:00Z'),
      sl('k1', '2026-04-25T10:00:00Z', '2026-04-25T10:00:00Z'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.totalGaps, 1);
  // 5 minutes = 300s, lands in ≤300s bin (index 1).
  const d = r.distributions[0]!;
  assert.equal(d.maxSeconds, 300);
  assert.equal(d.p50Seconds, 300);
  assert.equal(d.bins[1]!.count, 1);
  assert.equal(d.modalBinIndex, 1);
});

test('idle-gaps: many gaps → quantiles via nearest-rank', () => {
  // session with snapshots at 0,1,2,...,10 minutes → 10 gaps each 60s.
  const lines: SessionLine[] = [];
  const base = Date.parse('2026-04-25T10:00:00Z');
  for (let i = 0; i <= 10; i++) {
    const ts = new Date(base + i * 60_000).toISOString();
    lines.push(sl('k1', '2026-04-25T10:00:00Z', ts));
  }
  const r = buildIdleGaps(lines, { generatedAt: GEN });
  assert.equal(r.totalGaps, 10);
  const d = r.distributions[0]!;
  assert.equal(d.p50Seconds, 60);
  assert.equal(d.p90Seconds, 60);
  assert.equal(d.p99Seconds, 60);
  assert.equal(d.maxSeconds, 60);
  // All 10 gaps land in the ≤60s bin.
  assert.equal(d.bins[0]!.count, 10);
  assert.equal(d.bins[0]!.share, 1);
  assert.equal(d.bins[0]!.cumulativeShare, 1);
});

test('idle-gaps: minGapSeconds floor drops short gaps', () => {
  const lines: SessionLine[] = [
    sl('k1', '2026-04-25T10:00:00Z', '2026-04-25T10:00:00Z'),
    sl('k1', '2026-04-25T10:00:00Z', '2026-04-25T10:00:30Z'), // 30s
    sl('k1', '2026-04-25T10:00:00Z', '2026-04-25T10:05:00Z'), // 270s
  ];
  const r = buildIdleGaps(lines, { generatedAt: GEN, minGapSeconds: 60 });
  assert.equal(r.droppedBelowFloor, 1);
  assert.equal(r.totalGaps, 1);
  assert.equal(r.distributions[0]!.maxSeconds, 270);
});

test('idle-gaps: window filters by started_at', () => {
  const lines: SessionLine[] = [
    sl('inside', '2026-04-25T10:00:00Z', '2026-04-25T10:00:00Z'),
    sl('inside', '2026-04-25T10:00:00Z', '2026-04-25T10:01:00Z'),
    sl('outside', '2026-04-20T10:00:00Z', '2026-04-20T10:00:00Z'),
    sl('outside', '2026-04-20T10:00:00Z', '2026-04-20T10:01:00Z'),
  ];
  const r = buildIdleGaps(lines, {
    generatedAt: GEN,
    since: '2026-04-25T00:00:00Z',
  });
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.totalGaps, 1);
});

test('idle-gaps: by=source splits per source, sorted by totalGaps desc', () => {
  const lines: SessionLine[] = [
    // sourceA: 1 session, 2 gaps
    sl('a1', '2026-04-25T10:00:00Z', '2026-04-25T10:00:00Z', { source: 'sourceA' }),
    sl('a1', '2026-04-25T10:00:00Z', '2026-04-25T10:01:00Z', { source: 'sourceA' }),
    sl('a1', '2026-04-25T10:00:00Z', '2026-04-25T10:02:00Z', { source: 'sourceA' }),
    // sourceB: 1 session, 1 gap
    sl('b1', '2026-04-25T10:00:00Z', '2026-04-25T10:00:00Z', { source: 'sourceB' }),
    sl('b1', '2026-04-25T10:00:00Z', '2026-04-25T10:01:00Z', { source: 'sourceB' }),
  ];
  const r = buildIdleGaps(lines, { generatedAt: GEN, by: 'source' });
  assert.equal(r.distributions.length, 2);
  assert.equal(r.distributions[0]!.group, 'sourceA');
  assert.equal(r.distributions[0]!.totalGaps, 2);
  assert.equal(r.distributions[1]!.group, 'sourceB');
  assert.equal(r.distributions[1]!.totalGaps, 1);
});

test('idle-gaps: invalid snapshot_at counted in droppedInvalidSnapshots', () => {
  const lines: SessionLine[] = [
    sl('k1', '2026-04-25T10:00:00Z', '2026-04-25T10:00:00Z'),
    sl('k1', '2026-04-25T10:00:00Z', 'not-a-date'),
    sl('k1', '2026-04-25T10:00:00Z', '2026-04-25T10:01:00Z'),
  ];
  const r = buildIdleGaps(lines, { generatedAt: GEN });
  assert.equal(r.droppedInvalidSnapshots, 1);
  assert.equal(r.totalGaps, 1);
});

test('idle-gaps: custom edges respected, label scheme', () => {
  const r = buildIdleGaps([], { generatedAt: GEN, edges: [10, 100] });
  const labels = r.distributions[0]!.bins.map((b) => b.label);
  assert.deepEqual(labels, ['≤10s', '10s-100s', '>100s']);
});
