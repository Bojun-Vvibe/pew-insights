import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildTurnCadence,
  DEFAULT_CADENCE_EDGES_SECONDS,
} from '../src/turncadence.js';
import type { SessionLine } from '../src/types.js';

function sl(
  startedAt: string,
  user: number,
  durationSeconds: number,
  opts: Partial<SessionLine> = {},
): SessionLine {
  return {
    session_key: opts.session_key ?? `s-${startedAt}-${user}-${durationSeconds}`,
    source: opts.source ?? 'src1',
    kind: opts.kind ?? 'human',
    started_at: startedAt,
    last_message_at: opts.last_message_at ?? startedAt,
    duration_seconds: durationSeconds,
    user_messages: user,
    assistant_messages: opts.assistant_messages ?? user,
    total_messages: opts.total_messages ?? user * 2,
    project_ref: opts.project_ref ?? '0000000000000000',
    model: opts.model ?? 'm1',
    snapshot_at: opts.snapshot_at ?? startedAt,
  };
}

const GEN = '2026-04-24T12:00:00.000Z';

test('turn-cadence: rejects bad by', () => {
  // @ts-expect-error testing runtime validation
  assert.throws(() => buildTurnCadence([], { by: 'bogus' }));
});

test('turn-cadence: rejects bad minDurationSeconds', () => {
  assert.throws(() => buildTurnCadence([], { minDurationSeconds: -1 }));
  assert.throws(() => buildTurnCadence([], { minDurationSeconds: Number.NaN }));
});

test('turn-cadence: rejects bad edges', () => {
  assert.throws(() => buildTurnCadence([], { edges: [10, 5] }));
  assert.throws(() => buildTurnCadence([], { edges: [10, 10] }));
  assert.throws(() => buildTurnCadence([], { edges: [-1] }));
  assert.throws(() => buildTurnCadence([], { edges: [] }));
});

test('turn-cadence: rejects bad since/until', () => {
  assert.throws(() => buildTurnCadence([], { since: 'not-an-iso' }));
  assert.throws(() => buildTurnCadence([], { until: 'not-an-iso' }));
});

test('turn-cadence: empty input → single empty distribution', () => {
  const r = buildTurnCadence([], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.distributions.length, 1);
  const d = r.distributions[0]!;
  assert.equal(d.group, 'all');
  assert.equal(d.totalSessions, 0);
  assert.equal(d.modalBinIndex, -1);
  assert.equal(d.bins.length, DEFAULT_CADENCE_EDGES_SECONDS.length + 1);
  for (const b of d.bins) assert.equal(b.count, 0);
});

test('turn-cadence: drops sessions with user_messages == 0 and counts them', () => {
  const r = buildTurnCadence(
    [
      sl('2026-04-20T10:00:00Z', 0, 100),
      sl('2026-04-20T11:00:00Z', 0, 50),
      sl('2026-04-20T12:00:00Z', 5, 100),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.droppedZeroUserMessages, 2);
  assert.equal(r.droppedMinDuration, 0);
});

test('turn-cadence: drops sessions below min-duration floor', () => {
  const r = buildTurnCadence(
    [
      sl('2026-04-20T10:00:00Z', 5, 0),
      sl('2026-04-20T11:00:00Z', 5, 0.5),
      sl('2026-04-20T12:00:00Z', 5, 100),
    ],
    { generatedAt: GEN, minDurationSeconds: 1 },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.droppedMinDuration, 2);
});

test('turn-cadence: cadence is duration / user_messages', () => {
  // 5 user msgs in 100s → cadence 20s → falls in '10-30s' bin (index 1)
  const r = buildTurnCadence([sl('2026-04-20T10:00:00Z', 5, 100)], {
    generatedAt: GEN,
  });
  const d = r.distributions[0]!;
  assert.equal(d.totalSessions, 1);
  assert.equal(d.meanSeconds, 20);
  assert.equal(d.p50Seconds, 20);
  assert.equal(d.maxSeconds, 20);
  assert.equal(d.bins[1]!.count, 1);
  assert.equal(d.bins[0]!.count, 0);
});

test('turn-cadence: bins boundary is inclusive on upper edge', () => {
  // cadence = 10 → falls in first bin '≤10s' (inclusive upper)
  const r = buildTurnCadence([sl('2026-04-20T10:00:00Z', 1, 10)], {
    generatedAt: GEN,
  });
  const d = r.distributions[0]!;
  assert.equal(d.bins[0]!.count, 1);
  assert.equal(d.bins[1]!.count, 0);
});

test('turn-cadence: open-ended final bin captures large cadences', () => {
  // cadence = 3600s (1h) → falls in '>1800s' (last bin)
  const r = buildTurnCadence([sl('2026-04-20T10:00:00Z', 1, 3600)], {
    generatedAt: GEN,
  });
  const d = r.distributions[0]!;
  const last = d.bins[d.bins.length - 1]!;
  assert.equal(last.count, 1);
  assert.equal(last.upperSeconds, null);
  assert.equal(last.cumulativeShare, 1);
});

test('turn-cadence: window filters by started_at (inclusive since, exclusive until)', () => {
  const sessions = [
    sl('2026-04-19T23:59:59Z', 5, 100), // before
    sl('2026-04-20T00:00:00Z', 5, 100), // since-inclusive
    sl('2026-04-20T12:00:00Z', 5, 100), // inside
    sl('2026-04-21T00:00:00Z', 5, 100), // until-exclusive
  ];
  const r = buildTurnCadence(sessions, {
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-21T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.consideredSessions, 2);
});

test('turn-cadence: by source emits one distribution per source, sorted desc by count', () => {
  const sessions = [
    sl('2026-04-20T10:00:00Z', 5, 100, { source: 'a' }),
    sl('2026-04-20T11:00:00Z', 5, 100, { source: 'a' }),
    sl('2026-04-20T12:00:00Z', 5, 100, { source: 'a' }),
    sl('2026-04-20T13:00:00Z', 5, 100, { source: 'b' }),
  ];
  const r = buildTurnCadence(sessions, { by: 'source', generatedAt: GEN });
  assert.equal(r.distributions.length, 2);
  assert.equal(r.distributions[0]!.group, 'a');
  assert.equal(r.distributions[0]!.totalSessions, 3);
  assert.equal(r.distributions[1]!.group, 'b');
  assert.equal(r.distributions[1]!.totalSessions, 1);
});

test('turn-cadence: cumulative share monotonic and ends at 1', () => {
  const sessions = [
    sl('2026-04-20T10:00:00Z', 1, 5),    // ≤10s
    sl('2026-04-20T10:01:00Z', 1, 20),   // 10-30s
    sl('2026-04-20T10:02:00Z', 1, 200),  // 60-300s
    sl('2026-04-20T10:03:00Z', 1, 5000), // >1800s
  ];
  const r = buildTurnCadence(sessions, { generatedAt: GEN });
  const d = r.distributions[0]!;
  let prev = -1;
  for (const b of d.bins) {
    assert.ok(b.cumulativeShare >= prev, `cumulative not monotonic at ${b.label}`);
    prev = b.cumulativeShare;
  }
  assert.equal(d.bins[d.bins.length - 1]!.cumulativeShare, 1);
});

test('turn-cadence: quantile waypoints use nearest-rank', () => {
  // 10 cadences: 1..10 seconds → p50 = 5 (k = ceil(0.5*10) = 5 → 5th value)
  const sessions: SessionLine[] = [];
  for (let i = 1; i <= 10; i++) {
    sessions.push(sl(`2026-04-20T10:0${i - 1}:00Z`, 1, i));
  }
  const r = buildTurnCadence(sessions, { generatedAt: GEN });
  const d = r.distributions[0]!;
  assert.equal(d.totalSessions, 10);
  assert.equal(d.p50Seconds, 5);
  assert.equal(d.p90Seconds, 9);
  assert.equal(d.p99Seconds, 10);
  assert.equal(d.maxSeconds, 10);
});

test('turn-cadence: modal bin = bin with largest count, ties broken by tighter upper edge', () => {
  // Two cadences in '≤10s' (1, 2), two in '10-30s' (15, 20) → tie.
  // Tie-break should pick tighter upper edge → '≤10s' (index 0).
  const sessions = [
    sl('2026-04-20T10:00:00Z', 1, 1),
    sl('2026-04-20T10:01:00Z', 1, 2),
    sl('2026-04-20T10:02:00Z', 1, 15),
    sl('2026-04-20T10:03:00Z', 1, 20),
  ];
  const r = buildTurnCadence(sessions, { generatedAt: GEN });
  const d = r.distributions[0]!;
  assert.equal(d.modalBinIndex, 0);
});

test('turn-cadence: custom edges override defaults', () => {
  const r = buildTurnCadence(
    [sl('2026-04-20T10:00:00Z', 1, 50)],
    { edges: [100, 200], generatedAt: GEN },
  );
  const d = r.distributions[0]!;
  assert.equal(r.edges.length, 2);
  assert.equal(d.bins.length, 3); // 2 edges + open-ended
  assert.equal(d.bins[0]!.count, 1); // 50 ≤ 100
});

test('turn-cadence: per-bin median & mean of cadences inside that bin', () => {
  // Two cadences of 5s and 7s (both ≤10s bin) → bin median 5 (nearest-rank), mean 6
  const sessions = [
    sl('2026-04-20T10:00:00Z', 1, 5),
    sl('2026-04-20T10:01:00Z', 1, 7),
  ];
  const r = buildTurnCadence(sessions, { generatedAt: GEN });
  const bin = r.distributions[0]!.bins[0]!;
  assert.equal(bin.count, 2);
  assert.equal(bin.medianSeconds, 5);
  assert.equal(bin.meanSeconds, 6);
});

test('turn-cadence: report echoes window + minDurationSeconds + edges', () => {
  const r = buildTurnCadence([], {
    since: '2026-04-01T00:00:00Z',
    until: '2026-05-01T00:00:00Z',
    minDurationSeconds: 5,
    edges: [60, 120],
    generatedAt: GEN,
  });
  assert.equal(r.windowStart, '2026-04-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00Z');
  assert.equal(r.minDurationSeconds, 5);
  assert.deepEqual(r.edges, [60, 120]);
  assert.equal(r.generatedAt, GEN);
});

test('turn-cadence: skips negative duration / negative user_messages', () => {
  const sessions = [
    sl('2026-04-20T10:00:00Z', -1, 100),
    sl('2026-04-20T10:01:00Z', 5, -10),
    sl('2026-04-20T10:02:00Z', 5, 100),
  ];
  const r = buildTurnCadence(sessions, { generatedAt: GEN });
  assert.equal(r.consideredSessions, 1);
});

test('turn-cadence: rejects bad minUserMessages', () => {
  assert.throws(() => buildTurnCadence([], { minUserMessages: 0 }));
  assert.throws(() => buildTurnCadence([], { minUserMessages: -1 }));
  assert.throws(() => buildTurnCadence([], { minUserMessages: Number.NaN }));
});

test('turn-cadence: minUserMessages=2 drops single-prompt sessions, counted separately', () => {
  const sessions = [
    sl('2026-04-20T10:00:00Z', 1, 100), // single-prompt → dropped
    sl('2026-04-20T10:01:00Z', 1, 200), // single-prompt → dropped
    sl('2026-04-20T10:02:00Z', 5, 100), // kept (cadence 20)
    sl('2026-04-20T10:03:00Z', 0, 50),  // zero-user → dropped via the existing counter
  ];
  const r = buildTurnCadence(sessions, { minUserMessages: 2, generatedAt: GEN });
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.droppedMinUserMessages, 2);
  assert.equal(r.droppedZeroUserMessages, 1);
  assert.equal(r.minUserMessages, 2);
});

test('turn-cadence: minUserMessages defaults to 1 (no extra drops, single-prompt kept)', () => {
  const r = buildTurnCadence(
    [sl('2026-04-20T10:00:00Z', 1, 100)],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.droppedMinUserMessages, 0);
  assert.equal(r.minUserMessages, 1);
});

test('turn-cadence: minUserMessages reported on the report header', () => {
  const r = buildTurnCadence([], { minUserMessages: 3, generatedAt: GEN });
  assert.equal(r.minUserMessages, 3);
});

test('turn-cadence: minUserMessages does not double-count zero-user sessions', () => {
  // user_messages = 0 should hit droppedZeroUserMessages, not droppedMinUserMessages,
  // even when minUserMessages > 1.
  const r = buildTurnCadence(
    [sl('2026-04-20T10:00:00Z', 0, 100)],
    { minUserMessages: 5, generatedAt: GEN },
  );
  assert.equal(r.droppedZeroUserMessages, 1);
  assert.equal(r.droppedMinUserMessages, 0);
});

test('turn-cadence: stdev and cv are 0 when n < 2 (undefined estimator)', () => {
  const r = buildTurnCadence([sl('2026-04-20T10:00:00Z', 5, 100)], { generatedAt: GEN });
  const d = r.distributions[0]!;
  assert.equal(d.totalSessions, 1);
  assert.equal(d.stdevSeconds, 0);
  assert.equal(d.cadenceCV, 0);
});

test('turn-cadence: stdev computed with Bessel correction (n-1 denominator)', () => {
  // Two cadences: 10s and 20s → mean 15, sample stdev = sqrt(((10-15)^2 + (20-15)^2)/(2-1)) = sqrt(50)
  const sessions = [
    sl('2026-04-20T10:00:00Z', 1, 10),
    sl('2026-04-20T10:01:00Z', 1, 20),
  ];
  const r = buildTurnCadence(sessions, { generatedAt: GEN });
  const d = r.distributions[0]!;
  assert.equal(d.meanSeconds, 15);
  assert.ok(Math.abs(d.stdevSeconds - Math.sqrt(50)) < 1e-9);
});

test('turn-cadence: cv = stdev / mean and is 0 when mean is 0', () => {
  // Two zero-cadence sessions (duration 0, but min-duration 0 keeps them) → mean 0 → CV defined as 0
  const sessions = [
    sl('2026-04-20T10:00:00Z', 5, 0),
    sl('2026-04-20T10:01:00Z', 5, 0),
  ];
  const r = buildTurnCadence(sessions, { minDurationSeconds: 0, generatedAt: GEN });
  const d = r.distributions[0]!;
  assert.equal(d.meanSeconds, 0);
  assert.equal(d.cadenceCV, 0);
});

test('turn-cadence: cv is the dimensionless ratio stdev / mean', () => {
  const sessions = [
    sl('2026-04-20T10:00:00Z', 1, 10),
    sl('2026-04-20T10:01:00Z', 1, 20),
    sl('2026-04-20T10:02:00Z', 1, 30),
  ];
  const r = buildTurnCadence(sessions, { generatedAt: GEN });
  const d = r.distributions[0]!;
  // mean = 20, sample stdev = sqrt(((10-20)^2 + (20-20)^2 + (30-20)^2)/2) = sqrt(100) = 10
  // cv = 10 / 20 = 0.5
  assert.ok(Math.abs(d.meanSeconds - 20) < 1e-9);
  assert.ok(Math.abs(d.stdevSeconds - 10) < 1e-9);
  assert.ok(Math.abs(d.cadenceCV - 0.5) < 1e-9);
});

test('turn-cadence: empty distribution has stdev=0 and cv=0', () => {
  const r = buildTurnCadence([], { generatedAt: GEN });
  const d = r.distributions[0]!;
  assert.equal(d.totalSessions, 0);
  assert.equal(d.stdevSeconds, 0);
  assert.equal(d.cadenceCV, 0);
});
