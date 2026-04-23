import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  csvEscape,
  exportQueue,
  exportSessions,
  filterQueue,
  filterSessions,
} from '../src/export.ts';
import { DEFAULT_RATES } from '../src/cost.ts';
import type { QueueLine, SessionLine } from '../src/types.ts';

function q(hour: string, total: number, model = 'gpt-5.4', source = 'cli'): QueueLine {
  return {
    source,
    model,
    hour_start: hour,
    device_id: 'd1',
    input_tokens: total,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

function s(key: string, last: string, model = 'gpt-5.4', source = 'cli'): SessionLine {
  return {
    session_key: key,
    source,
    kind: 'human',
    started_at: last,
    last_message_at: last,
    duration_seconds: 60,
    user_messages: 1,
    assistant_messages: 1,
    total_messages: 2,
    project_ref: '0123456789abcdef',
    model,
    snapshot_at: last,
  };
}

// ---------------------------------------------------------------------------
// csvEscape
// ---------------------------------------------------------------------------

test('csvEscape: plain string passes through', () => {
  assert.equal(csvEscape('hello'), 'hello');
});

test('csvEscape: number passes through unquoted', () => {
  assert.equal(csvEscape(42), '42');
  assert.equal(csvEscape(0), '0');
  assert.equal(csvEscape(3.14), '3.14');
});

test('csvEscape: null/undefined → empty string', () => {
  assert.equal(csvEscape(null), '');
  assert.equal(csvEscape(undefined), '');
});

test('csvEscape: comma forces quoting', () => {
  assert.equal(csvEscape('a,b'), '"a,b"');
});

test('csvEscape: double-quote is doubled and quoted', () => {
  assert.equal(csvEscape('he said "hi"'), '"he said ""hi"""');
});

test('csvEscape: newline forces quoting', () => {
  assert.equal(csvEscape('line1\nline2'), '"line1\nline2"');
});

test('csvEscape: leading/trailing whitespace forces quoting', () => {
  assert.equal(csvEscape(' x'), '" x"');
  assert.equal(csvEscape('x '), '"x "');
});

test('csvEscape: boolean → string', () => {
  assert.equal(csvEscape(true), 'true');
  assert.equal(csvEscape(false), 'false');
});

// ---------------------------------------------------------------------------
// filterQueue / filterSessions
// ---------------------------------------------------------------------------

const QUEUE: QueueLine[] = [
  q('2026-04-01T00:00:00.000Z', 100, 'gpt-5.4', 'cli'),
  q('2026-04-10T00:00:00.000Z', 200, 'claude-opus-4.7', 'web'),
  q('2026-04-20T00:00:00.000Z', 300, 'gpt-5-nano', 'cli'),
];

test('filterQueue: no filters returns everything', () => {
  assert.equal(filterQueue(QUEUE, {}).length, 3);
});

test('filterQueue: since cutoff (inclusive lower)', () => {
  assert.equal(filterQueue(QUEUE, { since: '2026-04-10T00:00:00.000Z' }).length, 2);
});

test('filterQueue: until cutoff (exclusive upper)', () => {
  assert.equal(filterQueue(QUEUE, { until: '2026-04-10T00:00:00.000Z' }).length, 1);
});

test('filterQueue: since + until composes correctly', () => {
  const out = filterQueue(QUEUE, {
    since: '2026-04-05T00:00:00.000Z',
    until: '2026-04-15T00:00:00.000Z',
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].source, 'web');
});

test('filterQueue: source substring filter is case-insensitive', () => {
  assert.equal(filterQueue(QUEUE, { source: 'CLI' }).length, 2);
  assert.equal(filterQueue(QUEUE, { source: 'we' }).length, 1);
});

test('filterQueue: model substring filter matches normalised model', () => {
  // Pass a raw upstream prefix; normaliseModel strips it.
  const queue: QueueLine[] = [
    q('2026-04-10T00:00:00.000Z', 100, 'github_copilot/gpt-5.4'),
    q('2026-04-10T00:00:00.000Z', 100, 'claude-sonnet-4.6'),
  ];
  assert.equal(filterQueue(queue, { model: 'gpt' }).length, 1);
  assert.equal(filterQueue(queue, { model: 'claude' }).length, 1);
});

test('filterSessions: filters by last_message_at, source, and model', () => {
  const sess: SessionLine[] = [
    s('a', '2026-04-01T00:00:00.000Z', 'gpt-5.4', 'cli'),
    s('b', '2026-04-15T00:00:00.000Z', 'claude-opus-4.7', 'web'),
  ];
  assert.equal(filterSessions(sess, { since: '2026-04-10T00:00:00Z' }).length, 1);
  assert.equal(filterSessions(sess, { source: 'web' }).length, 1);
  assert.equal(filterSessions(sess, { model: 'claude' }).length, 1);
});

// ---------------------------------------------------------------------------
// exportQueue
// ---------------------------------------------------------------------------

test('exportQueue: csv has header + N rows + trailing newline', () => {
  const out = exportQueue(QUEUE, 'csv');
  const lines = out.body.split('\n');
  // header + 3 rows + trailing empty from final '\n'
  assert.equal(lines.length, 5);
  assert.ok(lines[0].startsWith('hour_start,source,model'));
  assert.equal(out.rowCount, 3);
});

test('exportQueue: csv quotes commas and quotes', () => {
  const queue: QueueLine[] = [q('2026-04-01T00:00:00Z', 1, 'name,with,comma', 'src')];
  const out = exportQueue(queue, 'csv');
  // model field must be quoted.
  assert.ok(out.body.includes('"name,with,comma"'));
});

test('exportQueue: ndjson has 1 JSON object per line', () => {
  const out = exportQueue(QUEUE, 'ndjson');
  const lines = out.body.trim().split('\n');
  assert.equal(lines.length, 3);
  for (const line of lines) {
    const obj = JSON.parse(line);
    assert.ok('hour_start' in obj);
    assert.ok('total_tokens' in obj);
    assert.ok('normalised_model' in obj);
  }
});

test('exportQueue: empty result still has CSV header but no body lines', () => {
  const out = exportQueue([], 'csv');
  const lines = out.body.split('\n').filter((l) => l !== '');
  assert.equal(lines.length, 1); // header only
  assert.equal(out.rowCount, 0);
});

test('exportQueue: empty result for ndjson is empty string', () => {
  const out = exportQueue([], 'ndjson');
  assert.equal(out.body, '');
  assert.equal(out.rowCount, 0);
});

test('exportQueue: filters apply before serialisation', () => {
  const out = exportQueue(QUEUE, 'csv', { source: 'cli' });
  assert.equal(out.rowCount, 2);
});

test('exportQueue: usd column populated when rates supplied', () => {
  const queue: QueueLine[] = [
    {
      source: 'cli',
      model: 'gpt-5.4',
      hour_start: '2026-04-01T00:00:00Z',
      device_id: 'd1',
      input_tokens: 1_000_000,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 1_000_000,
    },
  ];
  const out = exportQueue(queue, 'ndjson', {}, DEFAULT_RATES);
  const obj = JSON.parse(out.body.trim());
  // gpt-5.4 input rate = $5/M → expect 5.
  assert.ok(Math.abs(Number(obj.usd) - 5) < 1e-6);
});

test('exportQueue: usd column empty when rates omitted', () => {
  const out = exportQueue(QUEUE, 'ndjson', {}, null);
  const obj = JSON.parse(out.body.trim().split('\n')[0]);
  assert.equal(obj.usd, '');
});

test('exportQueue: csv usd column is numeric or empty (no quotes)', () => {
  const out = exportQueue(QUEUE, 'csv', {}, DEFAULT_RATES);
  const headerCols = out.body.split('\n')[0].split(',');
  const usdIdx = headerCols.indexOf('usd');
  assert.ok(usdIdx >= 0);
  const firstDataRow = out.body.split('\n')[1].split(',');
  assert.ok(/^-?\d+(\.\d+)?$/.test(firstDataRow[usdIdx]), `usd cell=${firstDataRow[usdIdx]}`);
});

// ---------------------------------------------------------------------------
// exportSessions
// ---------------------------------------------------------------------------

test('exportSessions: csv has the expected header', () => {
  const sess: SessionLine[] = [s('a', '2026-04-01T00:00:00Z')];
  const out = exportSessions(sess, 'csv');
  const header = out.body.split('\n')[0];
  assert.ok(header.startsWith('session_key,source,kind,started_at,last_message_at'));
});

test('exportSessions: ndjson includes normalised_model', () => {
  const sess: SessionLine[] = [s('a', '2026-04-01T00:00:00Z', 'github_copilot/gpt-5.4')];
  const out = exportSessions(sess, 'ndjson');
  const obj = JSON.parse(out.body.trim());
  assert.equal(obj.normalised_model, 'gpt-5.4');
  assert.equal(obj.model, 'github_copilot/gpt-5.4');
});
