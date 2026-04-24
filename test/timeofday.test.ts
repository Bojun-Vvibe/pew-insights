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

// ---- --collapse refinement -------------------------------------------------

test('collapse: default 1 → 24 buckets, hour field equals index', () => {
  const r = buildTimeOfDay([sl('2026-04-25T03:00:00.000Z')], { generatedAt: GEN });
  assert.equal(r.collapse, 1);
  assert.equal(r.hours.length, 24);
  for (let h = 0; h < 24; h++) assert.equal(r.hours[h]!.hour, h);
});

test('collapse: 6 → 4 quadrant buckets at 0, 6, 12, 18', () => {
  const r = buildTimeOfDay(
    [
      sl('2026-04-25T01:00:00.000Z'), // bucket 0 (00-05)
      sl('2026-04-25T05:59:00.000Z'), // bucket 0 (00-05)
      sl('2026-04-25T06:00:00.000Z'), // bucket 6 (06-11)
      sl('2026-04-25T11:59:00.000Z'), // bucket 6
      sl('2026-04-25T13:00:00.000Z'), // bucket 12
      sl('2026-04-25T20:00:00.000Z'), // bucket 18
      sl('2026-04-25T23:59:00.000Z'), // bucket 18
    ],
    { generatedAt: GEN, collapse: 6 },
  );
  assert.equal(r.collapse, 6);
  assert.equal(r.hours.length, 4);
  assert.deepEqual(
    r.hours.map((h) => h.hour),
    [0, 6, 12, 18],
  );
  assert.deepEqual(
    r.hours.map((h) => h.sessions),
    [2, 2, 1, 2],
  );
});

test('collapse: 12 → 2 buckets (AM/PM split), peakHour reported as bin start', () => {
  const r = buildTimeOfDay(
    [
      sl('2026-04-25T02:00:00.000Z'),
      sl('2026-04-25T04:00:00.000Z'),
      sl('2026-04-25T15:00:00.000Z'),
      sl('2026-04-25T15:30:00.000Z'),
      sl('2026-04-25T17:00:00.000Z'),
    ],
    { generatedAt: GEN, collapse: 12 },
  );
  assert.equal(r.hours.length, 2);
  assert.deepEqual(
    r.hours.map((h) => h.hour),
    [0, 12],
  );
  assert.equal(r.hours[0]!.sessions, 2);
  assert.equal(r.hours[1]!.sessions, 3);
  assert.equal(r.peakHour, 12); // start of the winning bin
  assert.equal(r.peakSessions, 3);
});

test('collapse: 24 → single bucket, all sessions land in it', () => {
  const r = buildTimeOfDay(
    [
      sl('2026-04-25T00:30:00.000Z'),
      sl('2026-04-25T13:00:00.000Z'),
      sl('2026-04-25T23:30:00.000Z'),
    ],
    { generatedAt: GEN, collapse: 24 },
  );
  assert.equal(r.hours.length, 1);
  assert.equal(r.hours[0]!.hour, 0);
  assert.equal(r.hours[0]!.sessions, 3);
  assert.equal(r.hours[0]!.share, 1);
  assert.equal(r.peakHour, 0);
});

test('collapse: rejects non-divisors of 24 and non-positive integers', () => {
  for (const bad of [0, 5, 7, 9, 10, 11, 13, 25, -6, 1.5, NaN]) {
    assert.throws(
      () => buildTimeOfDay([], { generatedAt: GEN, collapse: bad }),
      /collapse must be a positive divisor of 24/,
      `expected throw for collapse=${bad}`,
    );
  }
});

test('collapse: bySource still works (per-bin source map sums across collapsed hours)', () => {
  const r = buildTimeOfDay(
    [
      sl('2026-04-25T01:00:00.000Z', { source: 'opencode', session_key: 'a' }),
      sl('2026-04-25T02:00:00.000Z', { source: 'claude-code', session_key: 'b' }),
      sl('2026-04-25T05:00:00.000Z', { source: 'claude-code', session_key: 'c' }),
      sl('2026-04-25T07:00:00.000Z', { source: 'codex', session_key: 'd' }),
    ],
    { generatedAt: GEN, collapse: 6, bySource: true },
  );
  // bin 0 (00-05): opencode 1 + claude-code 2 = 3 sessions
  assert.equal(r.hours[0]!.sessions, 3);
  assert.equal(r.hours[0]!.bySource['claude-code'], 2);
  assert.equal(r.hours[0]!.bySource['opencode'], 1);
  // bin 6 (06-11): codex 1
  assert.equal(r.hours[1]!.sessions, 1);
  assert.equal(r.hours[1]!.bySource['codex'], 1);
});

test('collapse: tzOffset still applies to underlying hour before binning', () => {
  // UTC 06:00 + -07:00 = local 23:00 → with collapse 6, bin 18 (18-23)
  const r = buildTimeOfDay([sl('2026-04-25T06:00:00.000Z')], {
    generatedAt: GEN,
    tzOffset: '-07:00',
    collapse: 6,
  });
  assert.equal(r.hours.length, 4);
  assert.equal(r.hours[3]!.hour, 18);
  assert.equal(r.hours[3]!.sessions, 1);
});

// ---- JSON shape stability --------------------------------------------------

test('JSON shape: top-level keys are stable and collapse is echoed', () => {
  const r = buildTimeOfDay([sl('2026-04-25T10:00:00.000Z')], {
    generatedAt: GEN,
    collapse: 4,
    bySource: true,
    tzOffset: '+02:00',
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-26T00:00:00Z',
  });
  const json = JSON.parse(JSON.stringify(r));
  assert.deepEqual(
    Object.keys(json).sort(),
    [
      'bySource',
      'collapse',
      'consideredSessions',
      'droppedInvalidStartedAt',
      'generatedAt',
      'hours',
      'peakHour',
      'peakSessions',
      'tzOffset',
      'windowEnd',
      'windowStart',
    ].sort(),
  );
  assert.equal(json.collapse, 4);
  assert.equal(json.tzOffset, '+02:00');
  assert.equal(json.bySource, true);
  // collapse=4 → 6 buckets at 0,4,8,12,16,20
  assert.equal(json.hours.length, 6);
  assert.deepEqual(
    json.hours.map((h: { hour: number }) => h.hour),
    [0, 4, 8, 12, 16, 20],
  );
});

test('JSON shape: every hour bucket has a stable key set', () => {
  const r = buildTimeOfDay([sl('2026-04-25T03:00:00.000Z')], {
    generatedAt: GEN,
    bySource: true,
  });
  for (const h of r.hours) {
    assert.deepEqual(Object.keys(h).sort(), ['bySource', 'hour', 'sessions', 'share'].sort());
  }
});
