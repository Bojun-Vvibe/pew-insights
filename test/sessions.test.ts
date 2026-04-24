import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSessions } from '../src/sessions.js';
import type { SessionLine } from '../src/types.js';

function sl(
  startedAt: string,
  durationSeconds: number,
  totalMessages: number,
  opts: Partial<SessionLine> = {},
): SessionLine {
  const lastMessage = new Date(
    new Date(startedAt).getTime() + durationSeconds * 1000,
  ).toISOString();
  return {
    session_key: opts.session_key ?? `sk-${startedAt}`,
    source: opts.source ?? 'opencode',
    kind: opts.kind ?? 'agent',
    started_at: startedAt,
    last_message_at: opts.last_message_at ?? lastMessage,
    duration_seconds: durationSeconds,
    user_messages: opts.user_messages ?? Math.ceil(totalMessages / 2),
    assistant_messages: opts.assistant_messages ?? Math.floor(totalMessages / 2),
    total_messages: totalMessages,
    project_ref: opts.project_ref ?? 'aaaaaaaaaaaaaaaa',
    model: opts.model ?? 'sonnet',
    snapshot_at: opts.snapshot_at ?? lastMessage,
  };
}

test('sessions: rejects non-positive topN', () => {
  assert.throws(() => buildSessions([], { topN: 0 }));
  assert.throws(() => buildSessions([], { topN: -1 }));
  assert.throws(() => buildSessions([], { topN: 1.5 }));
});

test('sessions: rejects negative minDurationSeconds', () => {
  assert.throws(() => buildSessions([], { minDurationSeconds: -1 }));
});

test('sessions: rejects bad by', () => {
  // @ts-expect-error testing runtime guard
  assert.throws(() => buildSessions([], { by: 'bogus' }));
});

test('sessions: empty input yields zero totals and null pointers', () => {
  const r = buildSessions([], {});
  assert.equal(r.totalSessions, 0);
  assert.equal(r.totalDurationSeconds, 0);
  assert.equal(r.totalMessages, 0);
  assert.equal(r.longestSession, null);
  assert.equal(r.chattiestSession, null);
  assert.equal(r.durationStats.count, 0);
  assert.equal(r.durationStats.median, null);
  assert.equal(r.durationStats.p95, null);
  assert.equal(r.messageStats.median, null);
  assert.deepEqual(r.topGroups, []);
  assert.equal(r.groupCardinality, 0);
});

test('sessions: aggregates totals and surfaces longest + chattiest', () => {
  const sessions: SessionLine[] = [
    sl('2026-04-20T08:00:00.000Z', 60, 4),
    sl('2026-04-20T09:00:00.000Z', 7200, 18, { session_key: 'sk-long' }),
    sl('2026-04-20T10:00:00.000Z', 600, 50, { session_key: 'sk-chat' }),
    sl('2026-04-20T11:00:00.000Z', 300, 10),
  ];
  const r = buildSessions(sessions, {});
  assert.equal(r.totalSessions, 4);
  assert.equal(r.totalDurationSeconds, 60 + 7200 + 600 + 300);
  assert.equal(r.totalMessages, 4 + 18 + 50 + 10);
  assert.equal(r.longestSession?.sessionKey, 'sk-long');
  assert.equal(r.longestSession?.durationSeconds, 7200);
  assert.equal(r.chattiestSession?.sessionKey, 'sk-chat');
  assert.equal(r.chattiestSession?.totalMessages, 50);
});

test('sessions: longest tie-break = earlier started_at wins', () => {
  const sessions: SessionLine[] = [
    sl('2026-04-20T10:00:00.000Z', 600, 5, { session_key: 'sk-later' }),
    sl('2026-04-20T08:00:00.000Z', 600, 5, { session_key: 'sk-earlier' }),
  ];
  const r = buildSessions(sessions, {});
  assert.equal(r.longestSession?.sessionKey, 'sk-earlier');
  assert.equal(r.chattiestSession?.sessionKey, 'sk-earlier');
});

test('sessions: window since/until is exclusive on until', () => {
  const sessions: SessionLine[] = [
    sl('2026-04-19T23:00:00.000Z', 60, 2, { session_key: 'sk-before' }),
    sl('2026-04-20T00:00:00.000Z', 60, 2, { session_key: 'sk-in-1' }),
    sl('2026-04-20T12:00:00.000Z', 60, 2, { session_key: 'sk-in-2' }),
    sl('2026-04-21T00:00:00.000Z', 60, 2, { session_key: 'sk-after' }),
  ];
  const r = buildSessions(sessions, {
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-21T00:00:00.000Z',
  });
  assert.equal(r.totalSessions, 2);
  const keys = new Set([r.longestSession?.sessionKey, r.chattiestSession?.sessionKey]);
  assert.ok(!keys.has('sk-before'));
  assert.ok(!keys.has('sk-after'));
});

test('sessions: minDurationSeconds drops sub-threshold rows', () => {
  const sessions: SessionLine[] = [
    sl('2026-04-20T08:00:00.000Z', 5, 1),
    sl('2026-04-20T09:00:00.000Z', 30, 1),
    sl('2026-04-20T10:00:00.000Z', 600, 5),
  ];
  const r = buildSessions(sessions, { minDurationSeconds: 60 });
  assert.equal(r.totalSessions, 1);
  assert.equal(r.totalDurationSeconds, 600);
});

test('sessions: median uses lower-half average for even count', () => {
  const sessions: SessionLine[] = [
    sl('2026-04-20T08:00:00.000Z', 100, 1),
    sl('2026-04-20T09:00:00.000Z', 200, 1),
    sl('2026-04-20T10:00:00.000Z', 300, 1),
    sl('2026-04-20T11:00:00.000Z', 400, 1),
  ];
  const r = buildSessions(sessions, {});
  // median of [100,200,300,400] = (200+300)/2 = 250
  assert.equal(r.durationStats.median, 250);
});

test('sessions: p95 uses nearest-rank (k = ceil(0.95 * n))', () => {
  // n=20, ceil(0.95*20)=19. Sorted values 100..2000 step 100 -> 19th = 1900.
  const sessions: SessionLine[] = [];
  for (let i = 1; i <= 20; i++) {
    const startedAt = new Date(`2026-04-20T08:00:00.000Z`).toISOString();
    sessions.push(sl(startedAt, i * 100, 1, { session_key: `sk-${i}` }));
  }
  const r = buildSessions(sessions, {});
  assert.equal(r.durationStats.p95, 1900);
});

test('sessions: by=source groups correctly and sorts deterministically', () => {
  const sessions: SessionLine[] = [
    sl('2026-04-20T08:00:00.000Z', 100, 1, { source: 'opencode' }),
    sl('2026-04-20T09:00:00.000Z', 100, 1, { source: 'opencode' }),
    sl('2026-04-20T10:00:00.000Z', 500, 1, { source: 'crush' }),
    sl('2026-04-20T11:00:00.000Z', 100, 1, { source: 'codex' }),
  ];
  const r = buildSessions(sessions, { by: 'source' });
  assert.equal(r.topGroups[0]!.key, 'opencode');
  assert.equal(r.topGroups[0]!.sessions, 2);
  // crush + codex tied at 1 session, crush wins on totalDuration desc.
  assert.equal(r.topGroups[1]!.key, 'crush');
  assert.equal(r.topGroups[2]!.key, 'codex');
  assert.equal(r.groupCardinality, 3);
});

test('sessions: by=source ties on duration broken by key asc', () => {
  const sessions: SessionLine[] = [
    sl('2026-04-20T08:00:00.000Z', 100, 1, { source: 'zsh-helper' }),
    sl('2026-04-20T09:00:00.000Z', 100, 1, { source: 'aaa-tool' }),
  ];
  const r = buildSessions(sessions, { by: 'source' });
  assert.equal(r.topGroups[0]!.key, 'aaa-tool');
  assert.equal(r.topGroups[1]!.key, 'zsh-helper');
});

test('sessions: by=kind groups by session kind', () => {
  const sessions: SessionLine[] = [
    sl('2026-04-20T08:00:00.000Z', 100, 1, { kind: 'agent' }),
    sl('2026-04-20T09:00:00.000Z', 100, 1, { kind: 'human' }),
    sl('2026-04-20T10:00:00.000Z', 100, 1, { kind: 'agent' }),
  ];
  const r = buildSessions(sessions, { by: 'kind' });
  assert.equal(r.topGroups[0]!.key, 'agent');
  assert.equal(r.topGroups[0]!.sessions, 2);
});

test('sessions: by=project_ref groups by 16-hex ref', () => {
  const sessions: SessionLine[] = [
    sl('2026-04-20T08:00:00.000Z', 100, 1, { project_ref: 'aaaaaaaaaaaaaaaa' }),
    sl('2026-04-20T09:00:00.000Z', 100, 1, { project_ref: 'bbbbbbbbbbbbbbbb' }),
    sl('2026-04-20T10:00:00.000Z', 100, 1, { project_ref: 'aaaaaaaaaaaaaaaa' }),
    sl('2026-04-20T11:00:00.000Z', 100, 1, { project_ref: 'aaaaaaaaaaaaaaaa' }),
  ];
  const r = buildSessions(sessions, { by: 'project_ref' });
  assert.equal(r.topGroups[0]!.key, 'aaaaaaaaaaaaaaaa');
  assert.equal(r.topGroups[0]!.sessions, 3);
});

test('sessions: topN truncation reports cardinality of full set', () => {
  const sessions: SessionLine[] = [];
  for (let i = 0; i < 5; i++) {
    sessions.push(
      sl('2026-04-20T08:00:00.000Z', 100, 1, { source: `src-${i}` }),
    );
  }
  const r = buildSessions(sessions, { by: 'source', topN: 2 });
  assert.equal(r.topGroups.length, 2);
  assert.equal(r.groupCardinality, 5);
});

test('sessions: distribution stats report min/max correctly', () => {
  const sessions: SessionLine[] = [
    sl('2026-04-20T08:00:00.000Z', 7, 3),
    sl('2026-04-20T09:00:00.000Z', 9000, 200),
    sl('2026-04-20T10:00:00.000Z', 100, 50),
  ];
  const r = buildSessions(sessions, {});
  assert.equal(r.durationStats.min, 7);
  assert.equal(r.durationStats.max, 9000);
  assert.equal(r.messageStats.min, 3);
  assert.equal(r.messageStats.max, 200);
});

test('sessions: builder is deterministic on a given input', () => {
  const sessions: SessionLine[] = [
    sl('2026-04-20T08:00:00.000Z', 100, 5, { source: 'a' }),
    sl('2026-04-20T09:00:00.000Z', 200, 7, { source: 'b' }),
    sl('2026-04-20T10:00:00.000Z', 300, 11, { source: 'a' }),
  ];
  const r1 = buildSessions(sessions, { by: 'source' });
  const r2 = buildSessions(sessions, { by: 'source' });
  // generatedAt is a wall-clock stamp; everything else should match.
  assert.deepEqual(
    { ...r1, generatedAt: 'X' },
    { ...r2, generatedAt: 'X' },
  );
});
