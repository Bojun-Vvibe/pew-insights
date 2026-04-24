import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildTimeOfDay, parseTzOffsetMinutes } from '../src/timeofday.js';
import type { SessionLine } from '../src/types.js';

function sl(startedAt: string, opts: Partial<SessionLine> = {}): SessionLine {
  return {
    session_key: opts.session_key ?? `s-${startedAt}`,
    source: opts.source ?? 'claude-code',
    kind: opts.kind ?? 'human',
    started_at: startedAt,
    last_message_at: opts.last_message_at ?? startedAt,
    duration_seconds: opts.duration_seconds ?? 60,
    user_messages: opts.user_messages ?? 1,
    assistant_messages: opts.assistant_messages ?? 1,
    total_messages: opts.total_messages ?? 2,
    project_ref: opts.project_ref ?? '0000000000000000',
    model: opts.model ?? 'claude-opus-4.7',
    snapshot_at: opts.snapshot_at ?? startedAt,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- parseTzOffsetMinutes --------------------------------------------------

test('parseTzOffsetMinutes: Z and z are 0', () => {
  assert.equal(parseTzOffsetMinutes('Z'), 0);
  assert.equal(parseTzOffsetMinutes('z'), 0);
});

test('parseTzOffsetMinutes: ±HH:MM, ±HHMM, ±HH all parse', () => {
  assert.equal(parseTzOffsetMinutes('-07:00'), -7 * 60);
  assert.equal(parseTzOffsetMinutes('+08:00'), 8 * 60);
  assert.equal(parseTzOffsetMinutes('-0700'), -7 * 60);
  assert.equal(parseTzOffsetMinutes('+05:30'), 5 * 60 + 30);
  assert.equal(parseTzOffsetMinutes('-05'), -5 * 60);
});

test('parseTzOffsetMinutes: rejects garbage', () => {
  assert.equal(parseTzOffsetMinutes(''), null);
  assert.equal(parseTzOffsetMinutes('PST'), null);
  assert.equal(parseTzOffsetMinutes('+25:00'), null);
  assert.equal(parseTzOffsetMinutes('+05:99'), null);
  assert.equal(parseTzOffsetMinutes('07:00'), null); // missing sign
});

// ---- buildTimeOfDay --------------------------------------------------------

test('buildTimeOfDay: empty input → 24 zero-buckets, peakHour -1', () => {
  const r = buildTimeOfDay([], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.peakHour, -1);
  assert.equal(r.peakSessions, 0);
  assert.equal(r.hours.length, 24);
  for (let h = 0; h < 24; h++) {
    assert.equal(r.hours[h]!.hour, h);
    assert.equal(r.hours[h]!.sessions, 0);
    assert.equal(r.hours[h]!.share, 0);
  }
  assert.equal(r.tzOffset, 'Z');
  assert.equal(r.bySource, false);
});

test('buildTimeOfDay: bucketing in UTC', () => {
  const r = buildTimeOfDay(
    [
      sl('2026-04-25T03:15:00.000Z'),
      sl('2026-04-25T03:45:00.000Z'),
      sl('2026-04-25T17:00:00.000Z'),
      sl('2026-04-26T03:01:00.000Z'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 4);
  assert.equal(r.hours[3]!.sessions, 3);
  assert.equal(r.hours[17]!.sessions, 1);
  assert.equal(r.peakHour, 3);
  assert.equal(r.peakSessions, 3);
  assert.equal(r.hours[3]!.share, 0.75);
});

test('buildTimeOfDay: tz offset shifts hour bucket (UTC 02:00 + -07:00 = 19:00 prev day)', () => {
  const r = buildTimeOfDay(
    [sl('2026-04-25T02:30:00.000Z'), sl('2026-04-25T02:45:00.000Z')],
    { generatedAt: GEN, tzOffset: '-07:00' },
  );
  assert.equal(r.tzOffset, '-07:00');
  assert.equal(r.hours[19]!.sessions, 2);
  assert.equal(r.peakHour, 19);
});

test('buildTimeOfDay: positive offset wraps forward (UTC 23:00 + +08:00 = 07:00 next day)', () => {
  const r = buildTimeOfDay([sl('2026-04-25T23:30:00.000Z')], {
    generatedAt: GEN,
    tzOffset: '+08:00',
  });
  assert.equal(r.tzOffset, '+08:00');
  assert.equal(r.hours[7]!.sessions, 1);
});

test('buildTimeOfDay: half-hour offset (+05:30 IST) still buckets to whole hour', () => {
  // UTC 18:25 + 05:30 = local 23:55 → hour 23
  const r = buildTimeOfDay([sl('2026-04-25T18:25:00.000Z')], {
    generatedAt: GEN,
    tzOffset: '+05:30',
  });
  assert.equal(r.tzOffset, '+05:30');
  assert.equal(r.hours[23]!.sessions, 1);
});

test('buildTimeOfDay: window filter applies on started_at (since inclusive, until exclusive)', () => {
  const r = buildTimeOfDay(
    [
      sl('2026-04-24T10:00:00.000Z'),
      sl('2026-04-25T10:00:00.000Z'),
      sl('2026-04-26T10:00:00.000Z'),
    ],
    {
      generatedAt: GEN,
      since: '2026-04-25T00:00:00Z',
      until: '2026-04-26T00:00:00Z',
    },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.hours[10]!.sessions, 1);
  assert.equal(r.windowStart, '2026-04-25T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-26T00:00:00Z');
});

test('buildTimeOfDay: drops sessions with non-parseable started_at', () => {
  const r = buildTimeOfDay(
    [
      sl('not-a-date'),
      sl(''),
      sl('2026-04-25T10:00:00.000Z'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.droppedInvalidStartedAt, 2);
  assert.equal(r.hours[10]!.sessions, 1);
});

test('buildTimeOfDay: bySource off → bySource is empty per bucket', () => {
  const r = buildTimeOfDay(
    [sl('2026-04-25T10:00:00.000Z', { source: 'claude-code' })],
    { generatedAt: GEN, bySource: false },
  );
  assert.deepEqual(r.hours[10]!.bySource, {});
  assert.equal(r.bySource, false);
});

test('buildTimeOfDay: bySource on → per-bucket source map populated, sorted by count desc then key asc', () => {
  const r = buildTimeOfDay(
    [
      sl('2026-04-25T10:00:00.000Z', { source: 'opencode', session_key: 'a' }),
      sl('2026-04-25T10:01:00.000Z', { source: 'claude-code', session_key: 'b' }),
      sl('2026-04-25T10:02:00.000Z', { source: 'claude-code', session_key: 'c' }),
      sl('2026-04-25T10:03:00.000Z', { source: 'codex', session_key: 'd' }),
      sl('2026-04-25T10:04:00.000Z', { source: 'codex', session_key: 'e' }),
    ],
    { generatedAt: GEN, bySource: true },
  );
  assert.equal(r.bySource, true);
  const m = r.hours[10]!.bySource;
  // claude-code 2, codex 2, opencode 1 → claude-code first (alpha), codex, opencode
  assert.deepEqual(Object.keys(m), ['claude-code', 'codex', 'opencode']);
  assert.equal(m['claude-code'], 2);
  assert.equal(m['codex'], 2);
  assert.equal(m['opencode'], 1);
});

test('buildTimeOfDay: bySource folds empty/non-string source to "unknown"', () => {
  const empty = sl('2026-04-25T10:00:00.000Z');
  empty.source = '';
  const missing = sl('2026-04-25T10:01:00.000Z');
  // Force a non-string source to exercise the defensive branch.
  (missing as unknown as { source: unknown }).source = null;
  const r = buildTimeOfDay([empty, missing], { generatedAt: GEN, bySource: true });
  assert.equal(r.hours[10]!.bySource['unknown'], 2);
});

test('buildTimeOfDay: peak ties broken by lowest hour', () => {
  const r = buildTimeOfDay(
    [
      sl('2026-04-25T03:00:00.000Z'),
      sl('2026-04-25T03:30:00.000Z'),
      sl('2026-04-25T15:00:00.000Z'),
      sl('2026-04-25T15:30:00.000Z'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.peakSessions, 2);
  assert.equal(r.peakHour, 3);
});

test('buildTimeOfDay: invalid tzOffset throws', () => {
  assert.throws(
    () => buildTimeOfDay([], { generatedAt: GEN, tzOffset: 'PST' }),
    /invalid tzOffset/,
  );
});

test('buildTimeOfDay: invalid since/until throws', () => {
  assert.throws(() => buildTimeOfDay([], { generatedAt: GEN, since: 'nope' }), /invalid since/);
  assert.throws(() => buildTimeOfDay([], { generatedAt: GEN, until: 'nope' }), /invalid until/);
});

test('buildTimeOfDay: shares sum to 1 (within float tolerance) when sessions present', () => {
  const r = buildTimeOfDay(
    [
      sl('2026-04-25T01:00:00.000Z'),
      sl('2026-04-25T05:00:00.000Z'),
      sl('2026-04-25T05:30:00.000Z'),
      sl('2026-04-25T22:00:00.000Z'),
    ],
    { generatedAt: GEN },
  );
  const total = r.hours.reduce((acc, h) => acc + h.share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `expected shares to sum to 1, got ${total}`);
});
