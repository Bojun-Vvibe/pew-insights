import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildMessageVolume,
  DEFAULT_VOLUME_EDGES,
} from '../src/messagevolume.js';
import type { SessionLine } from '../src/types.js';

function sl(
  startedAt: string,
  totalMessages: number,
  opts: Partial<SessionLine> = {},
): SessionLine {
  return {
    session_key: opts.session_key ?? `s-${startedAt}-${totalMessages}`,
    source: opts.source ?? 'src1',
    kind: opts.kind ?? 'human',
    started_at: startedAt,
    last_message_at: opts.last_message_at ?? startedAt,
    duration_seconds: opts.duration_seconds ?? 60,
    user_messages: opts.user_messages ?? Math.ceil(totalMessages / 2),
    assistant_messages: opts.assistant_messages ?? Math.floor(totalMessages / 2),
    total_messages: totalMessages,
    project_ref: opts.project_ref ?? '0000000000000000',
    model: opts.model ?? 'm1',
    snapshot_at: opts.snapshot_at ?? startedAt,
  };
}

const GEN = '2026-04-24T12:00:00.000Z';

test('message-volume: rejects bad by', () => {
  // @ts-expect-error testing runtime validation
  assert.throws(() => buildMessageVolume([], { by: 'bogus' }));
});

test('message-volume: rejects bad minTotalMessages', () => {
  assert.throws(() => buildMessageVolume([], { minTotalMessages: -1 }));
  assert.throws(() => buildMessageVolume([], { minTotalMessages: Number.NaN }));
});

test('message-volume: rejects bad edges', () => {
  assert.throws(() => buildMessageVolume([], { edges: [10, 5] }));
  assert.throws(() => buildMessageVolume([], { edges: [5, 5] }));
  assert.throws(() => buildMessageVolume([], { edges: [-1] }));
  assert.throws(() => buildMessageVolume([], { edges: [] }));
});

test('message-volume: rejects bad since/until', () => {
  assert.throws(() => buildMessageVolume([], { since: 'no' }));
  assert.throws(() => buildMessageVolume([], { until: 'no' }));
});

test('message-volume: empty input → single empty distribution', () => {
  const r = buildMessageVolume([], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.distributions.length, 1);
  const d = r.distributions[0]!;
  assert.equal(d.group, 'all');
  assert.equal(d.totalSessions, 0);
  assert.equal(d.modalBinIndex, -1);
  assert.equal(d.bins.length, DEFAULT_VOLUME_EDGES.length + 1);
  for (const b of d.bins) assert.equal(b.count, 0);
});

test('message-volume: drops sessions below min-total-messages', () => {
  const r = buildMessageVolume(
    [
      sl('2026-04-20T10:00:00Z', 0),
      sl('2026-04-20T11:00:00Z', 1),
      sl('2026-04-20T12:00:00Z', 5),
    ],
    { minTotalMessages: 2, generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.droppedMinMessages, 2);
});

test('message-volume: drops invalid (negative / non-finite) total_messages', () => {
  const r = buildMessageVolume(
    [
      sl('2026-04-20T10:00:00Z', -1),
      sl('2026-04-20T11:00:00Z', Number.NaN),
      sl('2026-04-20T12:00:00Z', 5),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.droppedInvalid, 2);
});

test('message-volume: bin assignment is inclusive on upper edge', () => {
  // edges [5, 20]: 5 → bin0 (≤5), 6 → bin1, 20 → bin1, 21 → bin2 (>20)
  const r = buildMessageVolume(
    [
      sl('2026-04-20T10:00:00Z', 5),
      sl('2026-04-20T11:00:00Z', 6),
      sl('2026-04-20T12:00:00Z', 20),
      sl('2026-04-20T13:00:00Z', 21),
    ],
    { edges: [5, 20], generatedAt: GEN },
  );
  const d = r.distributions[0]!;
  assert.equal(d.totalSessions, 4);
  assert.equal(d.bins[0]!.count, 1);
  assert.equal(d.bins[1]!.count, 2);
  assert.equal(d.bins[2]!.count, 1);
});

test('message-volume: quantiles via nearest-rank', () => {
  const sessions: SessionLine[] = [];
  for (let i = 1; i <= 10; i++) {
    const hh = String(i + 5).padStart(2, '0'); // 06..15
    sessions.push(sl(`2026-04-20T${hh}:00:00Z`, i));
  }
  const r = buildMessageVolume(sessions, { generatedAt: GEN });
  const d = r.distributions[0]!;
  assert.equal(d.p50Messages, 5);
  assert.equal(d.p90Messages, 9);
  assert.equal(d.p95Messages, 10);
  assert.equal(d.maxMessages, 10);
});

test('message-volume: window filter on started_at', () => {
  const r = buildMessageVolume(
    [
      sl('2026-04-19T23:00:00Z', 5),
      sl('2026-04-20T05:00:00Z', 5),
      sl('2026-04-20T20:00:00Z', 5),
      sl('2026-04-21T00:00:00Z', 5),
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
      generatedAt: GEN,
    },
  );
  assert.equal(r.consideredSessions, 2);
});

test('message-volume: by=source produces multiple distributions sorted by count desc', () => {
  const r = buildMessageVolume(
    [
      sl('2026-04-20T10:00:00Z', 5, { source: 'a' }),
      sl('2026-04-20T11:00:00Z', 6, { source: 'a' }),
      sl('2026-04-20T12:00:00Z', 7, { source: 'a' }),
      sl('2026-04-20T13:00:00Z', 8, { source: 'b' }),
    ],
    { by: 'source', generatedAt: GEN },
  );
  assert.equal(r.distributions.length, 2);
  assert.equal(r.distributions[0]!.group, 'a');
  assert.equal(r.distributions[0]!.totalSessions, 3);
  assert.equal(r.distributions[1]!.group, 'b');
});

test('message-volume: cumulativeShare is monotone and ends at 1.0', () => {
  const r = buildMessageVolume(
    [
      sl('2026-04-20T10:00:00Z', 1), // ≤2
      sl('2026-04-20T11:00:00Z', 8), // ≤10
      sl('2026-04-20T12:00:00Z', 30), // ≤50
      sl('2026-04-20T13:00:00Z', 500), // >200
    ],
    { generatedAt: GEN },
  );
  const d = r.distributions[0]!;
  assert.equal(d.bins[d.bins.length - 1]!.cumulativeShare, 1);
  for (let i = 1; i < d.bins.length; i++) {
    assert.ok(d.bins[i]!.cumulativeShare >= d.bins[i - 1]!.cumulativeShare);
  }
});

test('message-volume: per-bin median + mean computed only over bin members', () => {
  const r = buildMessageVolume(
    [
      sl('2026-04-20T10:00:00Z', 2),
      sl('2026-04-20T11:00:00Z', 4),
      sl('2026-04-20T12:00:00Z', 6),
    ],
    { edges: [10], generatedAt: GEN },
  );
  const b0 = r.distributions[0]!.bins[0]!;
  assert.equal(b0.count, 3);
  assert.equal(b0.medianMessages, 4);
  assert.equal(b0.meanMessages, 4);
  const b1 = r.distributions[0]!.bins[1]!;
  assert.equal(b1.count, 0);
  assert.equal(b1.medianMessages, 0);
});

test('message-volume: modalBinIndex picks largest count, ties → tighter upper bound', () => {
  // edges [10]: two ≤10, two >10 → tie, pick bin0
  const r = buildMessageVolume(
    [
      sl('2026-04-20T10:00:00Z', 5),
      sl('2026-04-20T11:00:00Z', 5),
      sl('2026-04-20T12:00:00Z', 50),
      sl('2026-04-20T13:00:00Z', 50),
    ],
    { edges: [10], generatedAt: GEN },
  );
  const d = r.distributions[0]!;
  assert.equal(d.bins[0]!.count, 2);
  assert.equal(d.bins[1]!.count, 2);
  assert.equal(d.modalBinIndex, 0);
});

test('message-volume: bin labels use lower=prev+1 form', () => {
  const r = buildMessageVolume([], { edges: [2, 5, 10], generatedAt: GEN });
  const d = r.distributions[0]!;
  assert.equal(d.bins[0]!.label, '≤2');
  assert.equal(d.bins[1]!.label, '3-5');
  assert.equal(d.bins[2]!.label, '6-10');
  assert.equal(d.bins[3]!.label, '>10');
  // singleton bin label
  const r2 = buildMessageVolume([], { edges: [2, 3], generatedAt: GEN });
  assert.equal(r2.distributions[0]!.bins[1]!.label, '3');
});

test('message-volume: report is JSON-serializable and round-trips losslessly', () => {
  const r = buildMessageVolume(
    [
      sl('2026-04-20T10:00:00Z', 3),
      sl('2026-04-20T11:00:00Z', 15, { source: 'b' }),
      sl('2026-04-20T12:00:00Z', 250, { source: 'b' }),
    ],
    { by: 'source', generatedAt: GEN },
  );
  const round = JSON.parse(JSON.stringify(r));
  assert.deepEqual(round, r);
  assert.equal(round.distributions.length, 2);
  for (const d of round.distributions) {
    assert.equal(typeof d.maxMessages, 'number');
  }
});
