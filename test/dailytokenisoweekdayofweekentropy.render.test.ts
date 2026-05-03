import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderDailyTokenIsoWeekDayOfWeekEntropy } from '../src/format.js';
import { buildDailyTokenIsoWeekDayOfWeekEntropy } from '../src/dailytokenisoweekdayofweekentropy.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-04T12:00:00.000Z';

function strip(s: string): string {
  // strip ANSI escape codes for stable text assertions
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

test('renderer: empty report -> "no source rows" hint', () => {
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy([], { generatedAt: GEN });
  const out = strip(renderDailyTokenIsoWeekDayOfWeekEntropy(r));
  assert.match(out, /pew-insights daily-token-isoweek-day-of-week-entropy/);
  assert.match(out, /no source rows after filters/);
});

test('renderer: header row contains all v0.6.401 refinement columns', () => {
  const queue: QueueLine[] = [
    ql('2026-01-05T10:00:00.000Z', 's1', 1000),
    ql('2026-01-06T10:00:00.000Z', 's1', 1000),
  ];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, { generatedAt: GEN });
  const out = strip(renderDailyTokenIsoWeekDayOfWeekEntropy(r));
  // Every column header must be present.
  for (const h of [
    'source',
    'firstDay',
    'lastDay',
    'days',
    'weeks',
    'meanH',
    'effDows',
    'wwDelta',
    'unwH',
    'minH',
    'maxH',
    'stdH',
    'regime',
    'meanDaily',
    'tokens',
  ]) {
    assert.ok(out.includes(h), `missing column header: ${h}`);
  }
});

test('renderer: uniform-week source surfaces effDows ~ 7 and positive wwDelta', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = String(5 + i).padStart(2, '0');
    queue.push(ql(`2026-01-${day}T10:00:00.000Z`, 's1', 1000));
  }
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, { generatedAt: GEN });
  const out = strip(renderDailyTokenIsoWeekDayOfWeekEntropy(r));
  // effDows column is fixed-2; uniform-7 -> "7.00".
  assert.match(out, /\b7\.00\b/);
  // workweekDelta should be positive (rendered with leading +).
  assert.match(out, /\+0\.1[0-9]{3}/);
  assert.match(out, /uniform-week/);
});

test('renderer: single-DOW source surfaces effDows = 1.00 and negative wwDelta', () => {
  const queue: QueueLine[] = [
    ql('2026-01-05T10:00:00.000Z', 's1', 5000),
    ql('2026-01-12T10:00:00.000Z', 's1', 5000),
  ];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, { generatedAt: GEN });
  const out = strip(renderDailyTokenIsoWeekDayOfWeekEntropy(r));
  assert.match(out, /\b1\.00\b/);
  assert.match(out, /-0\.82[0-9]{2}/);
  assert.match(out, /single-dow/);
});

test('renderer: dropped-counters legend always rendered', () => {
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy([], { generatedAt: GEN });
  const out = strip(renderDailyTokenIsoWeekDayOfWeekEntropy(r));
  for (const k of [
    'bad hour_start',
    'non-positive tokens',
    'source-filter',
    'below min-tokens',
    'below min-days',
    'below min-weeks',
    'below min-mean-entropy',
    'below top cap',
  ]) {
    assert.ok(out.includes(k), `missing dropped-counter legend: ${k}`);
  }
});

test('renderer: window legend shown only when since/until present', () => {
  const queue: QueueLine[] = [
    ql('2026-01-05T10:00:00.000Z', 's1', 1000),
    ql('2026-01-06T10:00:00.000Z', 's1', 1000),
  ];
  const r1 = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, {
    generatedAt: GEN,
    since: '2026-01-01T00:00:00Z',
  });
  const r2 = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, { generatedAt: GEN });
  assert.match(strip(renderDailyTokenIsoWeekDayOfWeekEntropy(r1)), /window:/);
  assert.doesNotMatch(strip(renderDailyTokenIsoWeekDayOfWeekEntropy(r2)), /window:/);
});

test('renderer: source-filter legend shown only when source set', () => {
  const queue: QueueLine[] = [
    ql('2026-01-05T10:00:00.000Z', 's1', 1000),
    ql('2026-01-06T10:00:00.000Z', 's1', 1000),
  ];
  const r1 = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, {
    generatedAt: GEN,
    source: 's1',
  });
  const r2 = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, { generatedAt: GEN });
  assert.match(strip(renderDailyTokenIsoWeekDayOfWeekEntropy(r1)), /source filter: s1/);
  assert.doesNotMatch(
    strip(renderDailyTokenIsoWeekDayOfWeekEntropy(r2)),
    /source filter:/,
  );
});
