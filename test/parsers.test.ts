import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normaliseModel, readSessionQueue, readQueue } from '../src/parsers.ts';
import { resolvePewPaths } from '../src/paths.ts';

test('normaliseModel: collapses claude-opus-4-7 variants', () => {
  assert.equal(normaliseModel('claude-opus-4-7'), 'claude-opus-4.7');
  assert.equal(normaliseModel('claude-opus-4.7'), 'claude-opus-4.7');
  assert.equal(normaliseModel('github_copilot/claude-opus-4.7'), 'claude-opus-4.7');
  assert.equal(normaliseModel('github.copilot-chat/claude-opus-4.7'), 'claude-opus-4.7');
});

test('normaliseModel: handles haiku date suffix and human-typed labels', () => {
  assert.equal(normaliseModel('claude-haiku-4-5-20251001'), 'claude-haiku-4.5');
  assert.equal(normaliseModel('claude-haiku-4.5'), 'claude-haiku-4.5');
  assert.equal(normaliseModel('github_copilot/Claude Haiku 4.5'), 'claude-haiku-4.5');
});

test('normaliseModel: maps placeholders to unknown', () => {
  assert.equal(normaliseModel('<synthetic>'), 'unknown');
  assert.equal(normaliseModel('opus'), 'unknown');
  assert.equal(normaliseModel('big-pickle'), 'unknown');
  assert.equal(normaliseModel(''), 'unknown');
});

test('readSessionQueue: dedupes by session_key keeping max snapshot_at', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pew-insights-test-'));
  const sqPath = join(dir, 'session-queue.jsonl');
  const lines = [
    JSON.stringify({
      session_key: 'k1', source: 'claude-code', kind: 'human',
      started_at: '2026-04-20T00:00:00.000Z', last_message_at: '2026-04-20T00:01:00.000Z',
      duration_seconds: 60, user_messages: 1, assistant_messages: 1, total_messages: 2,
      project_ref: 'aaaa', model: 'claude-opus-4.7', snapshot_at: '2026-04-20T00:05:00.000Z',
    }),
    JSON.stringify({
      session_key: 'k1', source: 'claude-code', kind: 'human',
      started_at: '2026-04-20T00:00:00.000Z', last_message_at: '2026-04-20T00:10:00.000Z',
      duration_seconds: 600, user_messages: 5, assistant_messages: 5, total_messages: 10,
      project_ref: 'aaaa', model: 'claude-opus-4.7', snapshot_at: '2026-04-20T00:15:00.000Z',
    }),
    JSON.stringify({
      session_key: 'k2', source: 'opencode', kind: 'human',
      started_at: '2026-04-20T01:00:00.000Z', last_message_at: '2026-04-20T01:01:00.000Z',
      duration_seconds: 60, user_messages: 1, assistant_messages: 1, total_messages: 2,
      project_ref: 'bbbb', model: 'gpt-5.4', snapshot_at: '2026-04-20T01:05:00.000Z',
    }),
  ];
  writeFileSync(sqPath, lines.join('\n') + '\n');
  const paths = resolvePewPaths(dir);
  const sessions = await readSessionQueue(paths);
  assert.equal(sessions.length, 2);
  const k1 = sessions.find((s) => s.session_key === 'k1')!;
  assert.equal(k1.total_messages, 10);
  assert.equal(k1.snapshot_at, '2026-04-20T00:15:00.000Z');
});

test('readQueue: streams JSONL and skips malformed lines', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pew-insights-test-'));
  mkdirSync(dir, { recursive: true });
  const qPath = join(dir, 'queue.jsonl');
  const lines = [
    JSON.stringify({
      source: 'claude-code', model: 'claude-opus-4.7', hour_start: '2026-04-20T12:00:00.000Z',
      device_id: 'd1', input_tokens: 100, cached_input_tokens: 50, output_tokens: 25,
      reasoning_output_tokens: 0, total_tokens: 175,
    }),
    'not valid json',
    '',
    JSON.stringify({
      source: 'opencode', model: 'gpt-5.4', hour_start: '2026-04-20T13:00:00.000Z',
      device_id: 'd1', input_tokens: 200, cached_input_tokens: 0, output_tokens: 50,
      reasoning_output_tokens: 10, total_tokens: 260,
    }),
  ];
  writeFileSync(qPath, lines.join('\n') + '\n');
  const paths = resolvePewPaths(dir);
  const queue = await readQueue(paths);
  assert.equal(queue.length, 2);
  assert.equal(queue[0]!.source, 'claude-code');
  assert.equal(queue[1]!.source, 'opencode');
});
