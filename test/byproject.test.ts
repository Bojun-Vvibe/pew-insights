import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attributeTokensByProject } from '../src/byproject.ts';
import type { QueueLine, SessionLine } from '../src/types.ts';

function q(o: Partial<QueueLine>): QueueLine {
  return {
    source: 'claude-code',
    model: 'claude-opus-4.7',
    hour_start: '2026-04-20T12:00:00.000Z',
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0,
    ...o,
  };
}

function s(o: Partial<SessionLine>): SessionLine {
  return {
    session_key: 'k',
    source: 'claude-code',
    kind: 'human',
    started_at: '2026-04-20T11:00:00.000Z',
    last_message_at: '2026-04-20T12:30:00.000Z',
    duration_seconds: 90,
    user_messages: 1,
    assistant_messages: 1,
    total_messages: 2,
    project_ref: 'aaaa',
    model: 'claude-opus-4.7',
    snapshot_at: '2026-04-20T13:00:00.000Z',
    ...o,
  };
}

test('attributeTokensByProject: distributes tokens by message share', () => {
  const queue: QueueLine[] = [q({ total_tokens: 1000 })];
  const sessions: SessionLine[] = [
    s({ session_key: 'k1', project_ref: 'aaaa', total_messages: 3 }),
    s({ session_key: 'k2', project_ref: 'bbbb', total_messages: 1 }),
  ];
  const out = attributeTokensByProject(queue, sessions, null);
  assert.equal(out.unattributedTokens, 0);
  const a = out.rows.find((r) => r.projectRef === 'aaaa')!;
  const b = out.rows.find((r) => r.projectRef === 'bbbb')!;
  // 3:1 split → 750 / 250.
  assert.equal(a.totalTokens, 750);
  assert.equal(b.totalTokens, 250);
  // First row is the larger.
  assert.equal(out.rows[0]!.projectRef, 'aaaa');
});

test('attributeTokensByProject: queue rows with no matching session → unattributed', () => {
  const queue: QueueLine[] = [q({ total_tokens: 500, source: 'codex' })];
  const sessions: SessionLine[] = [s({ project_ref: 'aaaa', source: 'claude-code' })];
  const out = attributeTokensByProject(queue, sessions, null);
  assert.equal(out.unattributedTokens, 500);
  assert.equal(out.rows.length, 0);
});

test('attributeTokensByProject: respects since window', () => {
  const queue: QueueLine[] = [
    q({ total_tokens: 100, hour_start: '2026-04-19T12:00:00.000Z' }),
    q({ total_tokens: 200, hour_start: '2026-04-21T12:00:00.000Z' }),
  ];
  const sessions: SessionLine[] = [
    s({ project_ref: 'aaaa', last_message_at: '2026-04-19T12:30:00.000Z' }),
    s({ project_ref: 'bbbb', last_message_at: '2026-04-21T12:30:00.000Z' }),
  ];
  const out = attributeTokensByProject(queue, sessions, '2026-04-20T00:00:00.000Z');
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0]!.projectRef, 'bbbb');
  assert.equal(out.rows[0]!.totalTokens, 200);
});

test('attributeTokensByProject: by-source breakdown sums to project total', () => {
  const queue: QueueLine[] = [
    q({ total_tokens: 100, source: 'claude-code' }),
    q({ total_tokens: 50, source: 'codex' }),
  ];
  const sessions: SessionLine[] = [
    s({ source: 'claude-code', project_ref: 'aaaa', total_messages: 1 }),
    s({ source: 'codex', project_ref: 'aaaa', total_messages: 1 }),
  ];
  const out = attributeTokensByProject(queue, sessions, null);
  const a = out.rows[0]!;
  const sum = a.bySource.reduce((s, x) => s + x.tokens, 0);
  assert.equal(a.totalTokens, 150);
  assert.equal(sum, 150);
});
