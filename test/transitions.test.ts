import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildTransitions } from '../src/transitions.js';
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
    source: opts.source ?? 'opencode',
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

test('transitions: rejects bad topN', () => {
  assert.throws(() => buildTransitions([], { topN: 0 }));
  assert.throws(() => buildTransitions([], { topN: -3 }));
  assert.throws(() => buildTransitions([], { topN: 1.5 }));
});

test('transitions: rejects bad maxGapSeconds', () => {
  assert.throws(() => buildTransitions([], { maxGapSeconds: -1 }));
  assert.throws(() => buildTransitions([], { maxGapSeconds: Number.NaN }));
});

test('transitions: rejects bad by dimension', () => {
  // @ts-expect-error testing runtime validation
  assert.throws(() => buildTransitions([], { by: 'bogus' }));
});

test('transitions: rejects invalid since/until', () => {
  assert.throws(() => buildTransitions([], { since: 'not-a-date' }));
  assert.throws(() => buildTransitions([], { until: 'also-bad' }));
});

test('transitions: empty input → zero handoffs, no rows', () => {
  const r = buildTransitions([], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.adjacentPairs, 0);
  assert.equal(r.handoffs, 0);
  assert.equal(r.breaks, 0);
  assert.equal(r.topTransitions.length, 0);
  assert.equal(r.stickiness.length, 0);
  assert.equal(r.groups.length, 0);
  assert.equal(r.overallMedianGapMs, 0);
  assert.equal(r.overallP95GapMs, 0);
});

test('transitions: single session → adjacentPairs == 0', () => {
  const r = buildTransitions(
    [sl('s1', '2026-04-24T10:00:00.000Z', '2026-04-24T10:30:00.000Z')],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.adjacentPairs, 0);
  assert.equal(r.handoffs, 0);
});

test('transitions: A → B handoff inside window counts; default by=source', () => {
  const sessions = [
    sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T10:10:00.000Z', { source: 'opencode' }),
    sl('b', '2026-04-24T10:11:00.000Z', '2026-04-24T10:15:00.000Z', { source: 'claude' }),
  ];
  const r = buildTransitions(sessions, { generatedAt: GEN });
  assert.equal(r.handoffs, 1);
  assert.equal(r.breaks, 0);
  assert.equal(r.topTransitions.length, 1);
  assert.equal(r.topTransitions[0]!.from, 'opencode');
  assert.equal(r.topTransitions[0]!.to, 'claude');
  assert.equal(r.topTransitions[0]!.count, 1);
  // 1 minute = 60_000 ms gap
  assert.equal(r.topTransitions[0]!.medianGapMs, 60_000);
  assert.equal(r.topTransitions[0]!.p95GapMs, 60_000);
  assert.equal(r.topTransitions[0]!.overlapCount, 0);
});

test('transitions: gap > maxGap → break, not handoff', () => {
  const sessions = [
    sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T10:10:00.000Z'),
    sl('b', '2026-04-24T13:00:00.000Z', '2026-04-24T13:05:00.000Z'),
  ];
  const r = buildTransitions(sessions, { generatedAt: GEN, maxGapSeconds: 1800 });
  assert.equal(r.handoffs, 0);
  assert.equal(r.breaks, 1);
  assert.equal(r.topTransitions.length, 0);
});

test('transitions: overlapping sessions → gap floored to 0, overlapCount++', () => {
  const sessions = [
    sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T10:30:00.000Z'),
    sl('b', '2026-04-24T10:20:00.000Z', '2026-04-24T10:40:00.000Z'),
  ];
  const r = buildTransitions(sessions, { generatedAt: GEN });
  assert.equal(r.handoffs, 1);
  assert.equal(r.overlaps, 1);
  assert.equal(r.topTransitions[0]!.medianGapMs, 0);
  assert.equal(r.topTransitions[0]!.overlapCount, 1);
});

test('transitions: stickiness self-loop tally', () => {
  // 3 opencode-to-opencode handoffs, 1 opencode-to-claude.
  const sessions = [
    sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T10:01:00.000Z', { source: 'opencode' }),
    sl('b', '2026-04-24T10:02:00.000Z', '2026-04-24T10:03:00.000Z', { source: 'opencode' }),
    sl('c', '2026-04-24T10:04:00.000Z', '2026-04-24T10:05:00.000Z', { source: 'opencode' }),
    sl('d', '2026-04-24T10:06:00.000Z', '2026-04-24T10:07:00.000Z', { source: 'opencode' }),
    sl('e', '2026-04-24T10:08:00.000Z', '2026-04-24T10:09:00.000Z', { source: 'claude' }),
  ];
  const r = buildTransitions(sessions, { generatedAt: GEN });
  assert.equal(r.handoffs, 4);
  const oc = r.stickiness.find((s) => s.group === 'opencode')!;
  assert.equal(oc.outgoing, 4);
  assert.equal(oc.selfLoop, 3);
  assert.equal(oc.stickiness, 0.75);
  // claude is terminal here (no outgoing) — should not appear in stickiness map.
  assert.equal(r.stickiness.find((s) => s.group === 'claude'), undefined);
});

test('transitions: top-N sort by count desc, then (from,to) asc tie-break', () => {
  // Two cells with count==2, names crafted to test deterministic order.
  const sessions: SessionLine[] = [];
  // zebra→alpha (2 times)
  sessions.push(sl('z1', '2026-04-24T10:00:00.000Z', '2026-04-24T10:01:00.000Z', { source: 'zebra' }));
  sessions.push(sl('a1', '2026-04-24T10:02:00.000Z', '2026-04-24T10:03:00.000Z', { source: 'alpha' }));
  sessions.push(sl('z2', '2026-04-24T10:04:00.000Z', '2026-04-24T10:05:00.000Z', { source: 'zebra' }));
  sessions.push(sl('a2', '2026-04-24T10:06:00.000Z', '2026-04-24T10:07:00.000Z', { source: 'alpha' }));
  // alpha→zebra (2 times)
  sessions.push(sl('z3', '2026-04-24T10:08:00.000Z', '2026-04-24T10:09:00.000Z', { source: 'zebra' }));
  sessions.push(sl('a3', '2026-04-24T10:10:00.000Z', '2026-04-24T10:11:00.000Z', { source: 'alpha' }));
  const r = buildTransitions(sessions, { generatedAt: GEN });
  // Counts: zebra→alpha=3 (positions 1,3,5 paired with previous), alpha→zebra=2.
  assert.equal(r.topTransitions[0]!.from, 'zebra');
  assert.equal(r.topTransitions[0]!.to, 'alpha');
  assert.equal(r.topTransitions[0]!.count, 3);
  assert.equal(r.topTransitions[1]!.from, 'alpha');
  assert.equal(r.topTransitions[1]!.to, 'zebra');
  assert.equal(r.topTransitions[1]!.count, 2);
});

test('transitions: top-N tie-break with equal counts uses (from,to) asc', () => {
  const sessions: SessionLine[] = [
    sl('s1', '2026-04-24T10:00:00.000Z', '2026-04-24T10:01:00.000Z', { source: 'b' }),
    sl('s2', '2026-04-24T10:02:00.000Z', '2026-04-24T10:03:00.000Z', { source: 'c' }),
    sl('s3', '2026-04-24T10:04:00.000Z', '2026-04-24T10:05:00.000Z', { source: 'a' }),
    sl('s4', '2026-04-24T10:06:00.000Z', '2026-04-24T10:07:00.000Z', { source: 'd' }),
  ];
  // Pairs: b→c, c→a, a→d. All count=1.
  const r = buildTransitions(sessions, { generatedAt: GEN });
  assert.equal(r.topTransitions.length, 3);
  assert.equal(r.topTransitions[0]!.from, 'a'); // a→d sorts first
  assert.equal(r.topTransitions[1]!.from, 'b'); // b→c
  assert.equal(r.topTransitions[2]!.from, 'c'); // c→a
});

test('transitions: top-N truncates extra cells', () => {
  const sessions: SessionLine[] = [];
  // 5 distinct from→to pairs.
  for (let i = 0; i < 6; i++) {
    sessions.push(
      sl(`s${i}`, `2026-04-24T10:0${i}:00.000Z`, `2026-04-24T10:0${i}:30.000Z`, {
        source: `src${i}`,
      }),
    );
  }
  const r = buildTransitions(sessions, { generatedAt: GEN, topN: 2 });
  assert.equal(r.topTransitions.length, 2);
  assert.equal(r.topN, 2);
});

test('transitions: --since/--until window filter on started_at', () => {
  const sessions = [
    sl('a', '2026-04-24T08:00:00.000Z', '2026-04-24T08:01:00.000Z'),
    sl('b', '2026-04-24T10:00:00.000Z', '2026-04-24T10:01:00.000Z'),
    sl('c', '2026-04-24T10:02:00.000Z', '2026-04-24T10:03:00.000Z'),
    sl('d', '2026-04-24T20:00:00.000Z', '2026-04-24T20:01:00.000Z'),
  ];
  const r = buildTransitions(sessions, {
    generatedAt: GEN,
    since: '2026-04-24T09:00:00.000Z',
    until: '2026-04-24T11:00:00.000Z',
  });
  assert.equal(r.consideredSessions, 2); // b and c
  assert.equal(r.handoffs, 1);
  assert.equal(r.topTransitions[0]!.count, 1);
});

test('transitions: by=kind groups on kind not source', () => {
  const sessions = [
    sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T10:01:00.000Z', { source: 'opencode', kind: 'human' }),
    sl('b', '2026-04-24T10:02:00.000Z', '2026-04-24T10:03:00.000Z', { source: 'claude', kind: 'agent' }),
  ];
  const r = buildTransitions(sessions, { generatedAt: GEN, by: 'kind' });
  assert.equal(r.by, 'kind');
  assert.equal(r.topTransitions[0]!.from, 'human');
  assert.equal(r.topTransitions[0]!.to, 'agent');
});

test('transitions: median + p95 over multiple gap samples', () => {
  // 5 handoffs A→B with gaps 60s, 120s, 180s, 240s, 300s (monotone).
  const sessions: SessionLine[] = [];
  let cursor = Date.parse('2026-04-24T10:00:00.000Z');
  const gapsSec = [60, 120, 180, 240, 300];
  for (let i = 0; i < gapsSec.length + 1; i++) {
    const start = new Date(cursor).toISOString();
    const end = new Date(cursor + 30_000).toISOString();
    sessions.push(sl(`s${i}`, start, end, { source: i % 2 === 0 ? 'A' : 'B' }));
    cursor += 30_000 + (gapsSec[i] ?? 0) * 1000;
  }
  const r = buildTransitions(sessions, { generatedAt: GEN, maxGapSeconds: 600 });
  assert.equal(r.handoffs, 5);
  // Per-cell stats: A→B has 3 gaps (60,180,300), B→A has 2 (120,240).
  const ab = r.topTransitions.find((c) => c.from === 'A' && c.to === 'B')!;
  assert.equal(ab.count, 3);
  assert.equal(ab.medianGapMs, 180_000);
  assert.equal(ab.p95GapMs, 300_000); // ceil(0.95*3) = 3 → max
  // Overall: 5 sorted gaps median=180_000, p95=300_000 (ceil(.95*5)=5).
  assert.equal(r.overallMedianGapMs, 180_000);
  assert.equal(r.overallP95GapMs, 300_000);
});

test('transitions: groups list is sorted asc and deduped', () => {
  const sessions = [
    sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T10:01:00.000Z', { source: 'zeta' }),
    sl('b', '2026-04-24T10:02:00.000Z', '2026-04-24T10:03:00.000Z', { source: 'alpha' }),
    sl('c', '2026-04-24T10:04:00.000Z', '2026-04-24T10:05:00.000Z', { source: 'mu' }),
    sl('d', '2026-04-24T10:06:00.000Z', '2026-04-24T10:07:00.000Z', { source: 'alpha' }),
  ];
  const r = buildTransitions(sessions, { generatedAt: GEN });
  assert.deepEqual(r.groups, ['alpha', 'mu', 'zeta']);
});

test('transitions: missing source falls back to "unknown"', () => {
  const a = sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T10:01:00.000Z');
  const b = sl('b', '2026-04-24T10:02:00.000Z', '2026-04-24T10:03:00.000Z');
  // @ts-expect-error simulate corrupt input
  a.source = '';
  // @ts-expect-error simulate corrupt input
  b.source = null;
  const r = buildTransitions([a, b], { generatedAt: GEN });
  assert.equal(r.handoffs, 1);
  assert.equal(r.topTransitions[0]!.from, 'unknown');
  assert.equal(r.topTransitions[0]!.to, 'unknown');
});

test('transitions: deterministic ordering when started_at ties on the same source', () => {
  // Same started_at → tie-break on session_key asc, so 'aaa' comes first.
  const sessions = [
    sl('zzz', '2026-04-24T10:00:00.000Z', '2026-04-24T10:00:30.000Z', { source: 'X' }),
    sl('aaa', '2026-04-24T10:00:00.000Z', '2026-04-24T10:00:30.000Z', { source: 'Y' }),
    sl('mmm', '2026-04-24T10:01:00.000Z', '2026-04-24T10:01:30.000Z', { source: 'Z' }),
  ];
  const r = buildTransitions(sessions, { generatedAt: GEN });
  // Order of filtered: aaa (Y), zzz (X), mmm (Z).
  // Pairs: Y→X then X→Z.
  assert.equal(r.handoffs, 2);
  const yx = r.topTransitions.find((c) => c.from === 'Y' && c.to === 'X');
  const xz = r.topTransitions.find((c) => c.from === 'X' && c.to === 'Z');
  assert.ok(yx, 'expected Y→X transition');
  assert.ok(xz, 'expected X→Z transition');
});

test('transitions: minCount filters surfaced cells but not stickiness', () => {
  // 3 X→X handoffs, 1 X→Y handoff.
  const sessions = [
    sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T10:01:00.000Z', { source: 'X' }),
    sl('b', '2026-04-24T10:02:00.000Z', '2026-04-24T10:03:00.000Z', { source: 'X' }),
    sl('c', '2026-04-24T10:04:00.000Z', '2026-04-24T10:05:00.000Z', { source: 'X' }),
    sl('d', '2026-04-24T10:06:00.000Z', '2026-04-24T10:07:00.000Z', { source: 'X' }),
    sl('e', '2026-04-24T10:08:00.000Z', '2026-04-24T10:09:00.000Z', { source: 'Y' }),
  ];
  const r = buildTransitions(sessions, { generatedAt: GEN, minCount: 2 });
  assert.equal(r.minCount, 2);
  // Only X→X (count=3) survives the surfaced table.
  assert.equal(r.topTransitions.length, 1);
  assert.equal(r.topTransitions[0]!.from, 'X');
  assert.equal(r.topTransitions[0]!.to, 'X');
  // Stickiness still tallies all 4 outgoing from X.
  const x = r.stickiness.find((s) => s.group === 'X')!;
  assert.equal(x.outgoing, 4);
  assert.equal(x.selfLoop, 3);
});

test('transitions: excludeSelfLoops drops A→A from the surfaced table only', () => {
  const sessions = [
    sl('a', '2026-04-24T10:00:00.000Z', '2026-04-24T10:01:00.000Z', { source: 'X' }),
    sl('b', '2026-04-24T10:02:00.000Z', '2026-04-24T10:03:00.000Z', { source: 'X' }),
    sl('c', '2026-04-24T10:04:00.000Z', '2026-04-24T10:05:00.000Z', { source: 'Y' }),
  ];
  const r = buildTransitions(sessions, { generatedAt: GEN, excludeSelfLoops: true });
  assert.equal(r.excludeSelfLoops, true);
  // X→X dropped; only X→Y surfaces.
  assert.equal(r.topTransitions.length, 1);
  assert.equal(r.topTransitions[0]!.from, 'X');
  assert.equal(r.topTransitions[0]!.to, 'Y');
  // handoffs (matrix-wide tally) still 2.
  assert.equal(r.handoffs, 2);
  // Stickiness for X still counts the X→X self-loop.
  const x = r.stickiness.find((s) => s.group === 'X')!;
  assert.equal(x.selfLoop, 1);
  assert.equal(x.outgoing, 2);
});

test('transitions: rejects bad minCount', () => {
  assert.throws(() => buildTransitions([], { minCount: -1 }));
  assert.throws(() => buildTransitions([], { minCount: 1.5 }));
});
