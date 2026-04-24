import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSessionLengths,
  DEFAULT_LENGTH_EDGES_SECONDS,
} from '../src/sessionlengths.js';
import type { SessionLine } from '../src/types.js';

function sl(
  startedAt: string,
  durationSeconds: number,
  opts: Partial<SessionLine> = {},
): SessionLine {
  return {
    session_key: opts.session_key ?? `s-${startedAt}-${durationSeconds}`,
    source: opts.source ?? 'src1',
    kind: opts.kind ?? 'human',
    started_at: startedAt,
    last_message_at: opts.last_message_at ?? startedAt,
    duration_seconds: durationSeconds,
    user_messages: opts.user_messages ?? 1,
    assistant_messages: opts.assistant_messages ?? 1,
    total_messages: opts.total_messages ?? 2,
    project_ref: opts.project_ref ?? '0000000000000000',
    model: opts.model ?? 'm1',
    snapshot_at: opts.snapshot_at ?? startedAt,
  };
}

const GEN = '2026-04-24T12:00:00.000Z';

test('session-lengths: rejects bad by', () => {
  // @ts-expect-error testing runtime validation
  assert.throws(() => buildSessionLengths([], { by: 'bogus' }));
});

test('session-lengths: rejects bad minDurationSeconds', () => {
  assert.throws(() => buildSessionLengths([], { minDurationSeconds: -1 }));
  assert.throws(() => buildSessionLengths([], { minDurationSeconds: Number.NaN }));
});

test('session-lengths: rejects bad edges (non-ascending)', () => {
  assert.throws(() => buildSessionLengths([], { edgesSeconds: [60, 30] }));
  assert.throws(() => buildSessionLengths([], { edgesSeconds: [60, 60] }));
  assert.throws(() => buildSessionLengths([], { edgesSeconds: [-1] }));
  assert.throws(() => buildSessionLengths([], { edgesSeconds: [] }));
});

test('session-lengths: rejects bad since/until', () => {
  assert.throws(() => buildSessionLengths([], { since: 'no' }));
  assert.throws(() => buildSessionLengths([], { until: 'no' }));
});

test('session-lengths: empty input → single empty distribution', () => {
  const r = buildSessionLengths([], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.distributions.length, 1);
  const d = r.distributions[0]!;
  assert.equal(d.group, 'all');
  assert.equal(d.totalSessions, 0);
  assert.equal(d.modalBinIndex, -1);
  assert.equal(d.bins.length, DEFAULT_LENGTH_EDGES_SECONDS.length + 1);
  for (const b of d.bins) assert.equal(b.count, 0);
});

test('session-lengths: bin assignment uses inclusive upper edge', () => {
  // Edges 60, 300; 60s lands in ≤1m, 61s lands in 1m-5m, 300s in 1m-5m, 301s in >5m.
  const r = buildSessionLengths(
    [
      sl('2026-04-20T10:00:00Z', 60),
      sl('2026-04-20T11:00:00Z', 61),
      sl('2026-04-20T12:00:00Z', 300),
      sl('2026-04-20T13:00:00Z', 301),
    ],
    { edgesSeconds: [60, 300], generatedAt: GEN },
  );
  const d = r.distributions[0]!;
  assert.equal(d.totalSessions, 4);
  assert.equal(d.bins[0]!.count, 1); // 60
  assert.equal(d.bins[1]!.count, 2); // 61, 300
  assert.equal(d.bins[2]!.count, 1); // 301
});

test('session-lengths: quantiles via nearest-rank', () => {
  const durs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const r = buildSessionLengths(
    durs.map((d, i) => sl(`2026-04-20T1${i}:00:00Z`, d)),
    { generatedAt: GEN },
  );
  const d = r.distributions[0]!;
  // nearest-rank(0.5, n=10) → k = ceil(5) = 5 → sortedAsc[4] = 50
  assert.equal(d.p50Seconds, 50);
  // nearest-rank(0.9) → k = 9 → sortedAsc[8] = 90
  assert.equal(d.p90Seconds, 90);
  assert.equal(d.p95Seconds, 100);
  assert.equal(d.p99Seconds, 100);
  assert.equal(d.maxSeconds, 100);
});

test('session-lengths: window filter on started_at', () => {
  const r = buildSessionLengths(
    [
      sl('2026-04-19T23:00:00Z', 100),
      sl('2026-04-20T05:00:00Z', 200),
      sl('2026-04-20T20:00:00Z', 300),
      sl('2026-04-21T00:00:00Z', 400), // exclusive upper
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
      generatedAt: GEN,
    },
  );
  assert.equal(r.consideredSessions, 2);
  assert.equal(r.distributions[0]!.totalSeconds, 500);
});

test('session-lengths: by=source produces multiple distributions sorted by count desc', () => {
  const r = buildSessionLengths(
    [
      sl('2026-04-20T10:00:00Z', 100, { source: 'a' }),
      sl('2026-04-20T11:00:00Z', 200, { source: 'a' }),
      sl('2026-04-20T12:00:00Z', 300, { source: 'a' }),
      sl('2026-04-20T13:00:00Z', 400, { source: 'b' }),
    ],
    { by: 'source', generatedAt: GEN },
  );
  assert.equal(r.distributions.length, 2);
  assert.equal(r.distributions[0]!.group, 'a');
  assert.equal(r.distributions[0]!.totalSessions, 3);
  assert.equal(r.distributions[1]!.group, 'b');
  assert.equal(r.distributions[1]!.totalSessions, 1);
});

test('session-lengths: minDurationSeconds drops short sessions', () => {
  const r = buildSessionLengths(
    [
      sl('2026-04-20T10:00:00Z', 30),
      sl('2026-04-20T11:00:00Z', 90),
      sl('2026-04-20T12:00:00Z', 1000),
    ],
    { minDurationSeconds: 60, generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 2);
  assert.equal(r.distributions[0]!.totalSeconds, 1090);
});

test('session-lengths: modalBinIndex picks largest count, ties → tighter upper bound', () => {
  // Two sessions in ≤1m (bin 0), two in >1m (open-ended); tie → bin 0 (tighter upper).
  const r = buildSessionLengths(
    [
      sl('2026-04-20T10:00:00Z', 30),
      sl('2026-04-20T11:00:00Z', 40),
      sl('2026-04-20T12:00:00Z', 100),
      sl('2026-04-20T13:00:00Z', 200),
    ],
    { edgesSeconds: [60], generatedAt: GEN },
  );
  const d = r.distributions[0]!;
  assert.equal(d.bins[0]!.count, 2);
  assert.equal(d.bins[1]!.count, 2);
  assert.equal(d.modalBinIndex, 0);
});

test('session-lengths: per-bin median + mean computed only over bin members', () => {
  const r = buildSessionLengths(
    [
      sl('2026-04-20T10:00:00Z', 10),
      sl('2026-04-20T11:00:00Z', 20),
      sl('2026-04-20T12:00:00Z', 30),
    ],
    { edgesSeconds: [60], generatedAt: GEN },
  );
  const b0 = r.distributions[0]!.bins[0]!;
  assert.equal(b0.count, 3);
  assert.equal(b0.medianSeconds, 20);
  assert.equal(b0.meanSeconds, 20);
  const b1 = r.distributions[0]!.bins[1]!;
  assert.equal(b1.count, 0);
  assert.equal(b1.medianSeconds, 0);
});
