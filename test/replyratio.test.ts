import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildReplyRatio,
  DEFAULT_RATIO_EDGES,
} from '../src/replyratio.js';
import type { SessionLine } from '../src/types.js';

function sl(
  startedAt: string,
  user: number,
  assistant: number,
  opts: Partial<SessionLine> = {},
): SessionLine {
  return {
    session_key: opts.session_key ?? `s-${startedAt}-${user}-${assistant}`,
    source: opts.source ?? 'src1',
    kind: opts.kind ?? 'human',
    started_at: startedAt,
    last_message_at: opts.last_message_at ?? startedAt,
    duration_seconds: opts.duration_seconds ?? 60,
    user_messages: user,
    assistant_messages: assistant,
    total_messages: opts.total_messages ?? user + assistant,
    project_ref: opts.project_ref ?? '0000000000000000',
    model: opts.model ?? 'm1',
    snapshot_at: opts.snapshot_at ?? startedAt,
  };
}

const GEN = '2026-04-24T12:00:00.000Z';

test('reply-ratio: rejects bad by', () => {
  // @ts-expect-error testing runtime validation
  assert.throws(() => buildReplyRatio([], { by: 'bogus' }));
});

test('reply-ratio: rejects bad minTotalMessages', () => {
  assert.throws(() => buildReplyRatio([], { minTotalMessages: -1 }));
  assert.throws(() => buildReplyRatio([], { minTotalMessages: Number.NaN }));
});

test('reply-ratio: rejects bad edges', () => {
  assert.throws(() => buildReplyRatio([], { edges: [1, 0.5] }));
  assert.throws(() => buildReplyRatio([], { edges: [1, 1] }));
  assert.throws(() => buildReplyRatio([], { edges: [-1] }));
  assert.throws(() => buildReplyRatio([], { edges: [] }));
});

test('reply-ratio: rejects bad since/until', () => {
  assert.throws(() => buildReplyRatio([], { since: 'no' }));
  assert.throws(() => buildReplyRatio([], { until: 'no' }));
});

test('reply-ratio: empty input → single empty distribution', () => {
  const r = buildReplyRatio([], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.distributions.length, 1);
  const d = r.distributions[0]!;
  assert.equal(d.group, 'all');
  assert.equal(d.totalSessions, 0);
  assert.equal(d.modalBinIndex, -1);
  assert.equal(d.bins.length, DEFAULT_RATIO_EDGES.length + 1);
  for (const b of d.bins) assert.equal(b.count, 0);
});

test('reply-ratio: drops sessions with user_messages == 0 and counts them', () => {
  const r = buildReplyRatio(
    [
      sl('2026-04-20T10:00:00Z', 0, 5),
      sl('2026-04-20T11:00:00Z', 0, 10),
      sl('2026-04-20T12:00:00Z', 1, 1),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.droppedZeroUserMessages, 2);
  assert.equal(r.droppedMinMessages, 0);
});

test('reply-ratio: drops sessions below min-total-messages', () => {
  const r = buildReplyRatio(
    [
      sl('2026-04-20T10:00:00Z', 1, 0, { total_messages: 1 }),
      sl('2026-04-20T11:00:00Z', 1, 1, { total_messages: 2 }),
      sl('2026-04-20T12:00:00Z', 2, 4, { total_messages: 6 }),
    ],
    { minTotalMessages: 3, generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.droppedMinMessages, 2);
});

test('reply-ratio: bin assignment is inclusive on upper edge', () => {
  // edges [1, 5]: ratio 1.0 → bin0 (≤1), 1.1 → bin1 (1-5), 5.0 → bin1, 5.1 → bin2 (>5)
  const r = buildReplyRatio(
    [
      sl('2026-04-20T10:00:00Z', 10, 10), // ratio 1.0
      sl('2026-04-20T11:00:00Z', 10, 11), // 1.1
      sl('2026-04-20T12:00:00Z', 1, 5),   // 5.0
      sl('2026-04-20T13:00:00Z', 10, 51), // 5.1
    ],
    { edges: [1, 5], generatedAt: GEN },
  );
  const d = r.distributions[0]!;
  assert.equal(d.totalSessions, 4);
  assert.equal(d.bins[0]!.count, 1);
  assert.equal(d.bins[1]!.count, 2);
  assert.equal(d.bins[2]!.count, 1);
});

test('reply-ratio: quantiles via nearest-rank', () => {
  // ratios 1..10
  const sessions: SessionLine[] = [];
  for (let i = 1; i <= 10; i++) {
    const hh = String(i + 5).padStart(2, '0'); // 06..15
    sessions.push(sl(`2026-04-20T${hh}:00:00Z`, 1, i));
  }
  const r = buildReplyRatio(sessions, { generatedAt: GEN });
  const d = r.distributions[0]!;
  assert.equal(d.p50Ratio, 5);
  assert.equal(d.p90Ratio, 9);
  assert.equal(d.p95Ratio, 10);
  assert.equal(d.maxRatio, 10);
});

test('reply-ratio: window filter on started_at', () => {
  const r = buildReplyRatio(
    [
      sl('2026-04-19T23:00:00Z', 1, 1),
      sl('2026-04-20T05:00:00Z', 1, 2),
      sl('2026-04-20T20:00:00Z', 1, 3),
      sl('2026-04-21T00:00:00Z', 1, 9),
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
      generatedAt: GEN,
    },
  );
  assert.equal(r.consideredSessions, 2);
});

test('reply-ratio: by=source produces multiple distributions sorted by count desc', () => {
  const r = buildReplyRatio(
    [
      sl('2026-04-20T10:00:00Z', 1, 1, { source: 'a' }),
      sl('2026-04-20T11:00:00Z', 1, 2, { source: 'a' }),
      sl('2026-04-20T12:00:00Z', 1, 3, { source: 'a' }),
      sl('2026-04-20T13:00:00Z', 1, 4, { source: 'b' }),
    ],
    { by: 'source', generatedAt: GEN },
  );
  assert.equal(r.distributions.length, 2);
  assert.equal(r.distributions[0]!.group, 'a');
  assert.equal(r.distributions[0]!.totalSessions, 3);
  assert.equal(r.distributions[1]!.group, 'b');
});

test('reply-ratio: cumulativeShare is monotone and ends at 1.0', () => {
  const r = buildReplyRatio(
    [
      sl('2026-04-20T10:00:00Z', 1, 0, { total_messages: 2 }), // ratio 0 → ≤0.5
      sl('2026-04-20T11:00:00Z', 1, 1), // 1.0 → ≤1
      sl('2026-04-20T12:00:00Z', 1, 3), // 3.0 → ≤5
      sl('2026-04-20T13:00:00Z', 1, 25), // 25 → >20
    ],
    { generatedAt: GEN },
  );
  const d = r.distributions[0]!;
  assert.equal(d.bins[d.bins.length - 1]!.cumulativeShare, 1);
  for (let i = 1; i < d.bins.length; i++) {
    assert.ok(d.bins[i]!.cumulativeShare >= d.bins[i - 1]!.cumulativeShare);
  }
});

test('reply-ratio: per-bin median + mean computed only over bin members', () => {
  // edges [10] — three sessions all in bin0 with ratios 1, 2, 3
  const r = buildReplyRatio(
    [
      sl('2026-04-20T10:00:00Z', 1, 1),
      sl('2026-04-20T11:00:00Z', 1, 2),
      sl('2026-04-20T12:00:00Z', 1, 3),
    ],
    { edges: [10], generatedAt: GEN },
  );
  const b0 = r.distributions[0]!.bins[0]!;
  assert.equal(b0.count, 3);
  assert.equal(b0.medianRatio, 2);
  assert.equal(b0.meanRatio, 2);
  const b1 = r.distributions[0]!.bins[1]!;
  assert.equal(b1.count, 0);
  assert.equal(b1.medianRatio, 0);
});

test('reply-ratio: modalBinIndex picks largest count, ties → tighter upper bound', () => {
  // edges [1]: two sessions ratio 0.5 (bin0), two ratio 5 (bin1 open)
  const r = buildReplyRatio(
    [
      sl('2026-04-20T10:00:00Z', 2, 1),
      sl('2026-04-20T11:00:00Z', 2, 1),
      sl('2026-04-20T12:00:00Z', 1, 5),
      sl('2026-04-20T13:00:00Z', 1, 5),
    ],
    { edges: [1], generatedAt: GEN },
  );
  const d = r.distributions[0]!;
  assert.equal(d.bins[0]!.count, 2);
  assert.equal(d.bins[1]!.count, 2);
  assert.equal(d.modalBinIndex, 0);
});

test('reply-ratio: aboveThresholdShare null when threshold not supplied', () => {
  const r = buildReplyRatio(
    [sl('2026-04-20T10:00:00Z', 1, 1), sl('2026-04-20T11:00:00Z', 1, 5)],
    { generatedAt: GEN },
  );
  assert.equal(r.threshold, null);
  assert.equal(r.distributions[0]!.aboveThresholdShare, null);
});

test('reply-ratio: aboveThresholdShare counts strictly greater (not >=)', () => {
  // ratios: 1, 5, 10, 20. threshold=5 → only 10 and 20 exceed → 2/4 = 0.5
  const r = buildReplyRatio(
    [
      sl('2026-04-20T10:00:00Z', 1, 1),
      sl('2026-04-20T11:00:00Z', 1, 5),
      sl('2026-04-20T12:00:00Z', 1, 10),
      sl('2026-04-20T13:00:00Z', 1, 20),
    ],
    { threshold: 5, generatedAt: GEN },
  );
  assert.equal(r.threshold, 5);
  assert.equal(r.distributions[0]!.aboveThresholdShare, 0.5);
});

test('reply-ratio: aboveThresholdShare on empty group is 0 (not null) when threshold supplied', () => {
  const r = buildReplyRatio([], { threshold: 10, generatedAt: GEN });
  assert.equal(r.distributions[0]!.aboveThresholdShare, 0);
});

test('reply-ratio: rejects bad threshold', () => {
  assert.throws(() => buildReplyRatio([], { threshold: 0 }));
  assert.throws(() => buildReplyRatio([], { threshold: -1 }));
  assert.throws(() => buildReplyRatio([], { threshold: Number.NaN }));
});

test('reply-ratio: report is JSON-serializable and round-trips losslessly', () => {
  // Stability test: the JSON payload that --json emits must be a
  // pure data shape (no functions, no Date objects, no Maps).
  // Catches accidental introduction of non-serializable fields.
  const r = buildReplyRatio(
    [
      sl('2026-04-20T10:00:00Z', 1, 1),
      sl('2026-04-20T11:00:00Z', 1, 5, { source: 'b' }),
      sl('2026-04-20T12:00:00Z', 1, 25, { source: 'b' }),
    ],
    { by: 'source', threshold: 5, generatedAt: GEN },
  );
  const round = JSON.parse(JSON.stringify(r));
  assert.deepEqual(round, r);
  // Spot-check a few invariants survived the trip.
  assert.equal(round.threshold, 5);
  assert.equal(round.distributions.length, 2);
  for (const d of round.distributions) {
    assert.equal(typeof d.aboveThresholdShare, 'number');
  }
});
