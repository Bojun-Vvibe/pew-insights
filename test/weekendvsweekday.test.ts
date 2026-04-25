import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildWeekendVsWeekday } from '../src/weekendvsweekday.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'codex',
    model: opts.model ?? 'gpt-5',
    hour_start: hourStart,
    device_id: opts.device_id ?? 'dev-a',
    input_tokens: opts.input_tokens ?? 100,
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? 100,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: opts.total_tokens ?? 200,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';
// 2026-04-25 = Saturday, 2026-04-26 = Sunday,
// 2026-04-27 = Monday,   2026-04-28 = Tuesday (UTC)

// ---- option validation -----------------------------------------------------

test('weekend-vs-weekday: rejects bad minRows', () => {
  assert.throws(() => buildWeekendVsWeekday([], { minRows: -1 }));
  assert.throws(() => buildWeekendVsWeekday([], { minRows: 1.5 }));
});

test('weekend-vs-weekday: rejects bad top', () => {
  assert.throws(() => buildWeekendVsWeekday([], { top: -1 }));
  assert.throws(() => buildWeekendVsWeekday([], { top: 2.5 }));
});

test('weekend-vs-weekday: rejects bad since/until', () => {
  assert.throws(() => buildWeekendVsWeekday([], { since: 'not-a-date' }));
  assert.throws(() => buildWeekendVsWeekday([], { until: 'nope' }));
});

// ---- empty / edge ----------------------------------------------------------

test('weekend-vs-weekday: empty queue returns zeros', () => {
  const r = buildWeekendVsWeekday([], { generatedAt: GEN });
  assert.equal(r.totalTokens, 0);
  assert.equal(r.weekendTokens, 0);
  assert.equal(r.weekdayTokens, 0);
  assert.equal(r.totalModels, 0);
  assert.equal(r.weekendShare, 0);
  assert.equal(r.weekendToWeekdayRatio, 0);
  assert.deepEqual(r.models, []);
});

test('weekend-vs-weekday: single weekend row → ratio is +Infinity', () => {
  const r = buildWeekendVsWeekday(
    [ql('2026-04-25T10:00:00Z', { total_tokens: 500 })],
    { generatedAt: GEN },
  );
  assert.equal(r.weekendTokens, 500);
  assert.equal(r.weekdayTokens, 0);
  assert.equal(r.weekendToWeekdayRatio, Number.POSITIVE_INFINITY);
  assert.equal(r.weekendShare, 1);
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0].weekendToWeekdayRatio, Number.POSITIVE_INFINITY);
});

test('weekend-vs-weekday: single weekday row → ratio = 0', () => {
  const r = buildWeekendVsWeekday(
    [ql('2026-04-27T10:00:00Z', { total_tokens: 300 })],
    { generatedAt: GEN },
  );
  assert.equal(r.weekendTokens, 0);
  assert.equal(r.weekdayTokens, 300);
  assert.equal(r.weekendToWeekdayRatio, 0);
  assert.equal(r.weekendShare, 0);
});

// ---- happy path ------------------------------------------------------------

test('weekend-vs-weekday: classifies Sat and Sun as weekend, Mon–Fri as weekday', () => {
  const queue = [
    ql('2026-04-25T01:00:00Z', { total_tokens: 100 }), // Sat
    ql('2026-04-26T01:00:00Z', { total_tokens: 100 }), // Sun
    ql('2026-04-27T01:00:00Z', { total_tokens: 200 }), // Mon
    ql('2026-04-28T01:00:00Z', { total_tokens: 300 }), // Tue
  ];
  const r = buildWeekendVsWeekday(queue, { generatedAt: GEN });
  assert.equal(r.weekendTokens, 200);
  assert.equal(r.weekdayTokens, 500);
  assert.equal(r.totalTokens, 700);
  assert.ok(Math.abs(r.weekendShare - 200 / 700) < 1e-9);
  assert.ok(Math.abs(r.weekendToWeekdayRatio - 200 / 500) < 1e-9);
});

test('weekend-vs-weekday: aggregates per model and sorts by totalTokens desc', () => {
  const queue = [
    ql('2026-04-25T01:00:00Z', { model: 'gpt-5', total_tokens: 100 }),
    ql('2026-04-27T01:00:00Z', { model: 'gpt-5', total_tokens: 100 }),
    ql('2026-04-25T02:00:00Z', { model: 'claude-sonnet-4.5', total_tokens: 1000 }),
    ql('2026-04-28T03:00:00Z', { model: 'claude-sonnet-4.5', total_tokens: 1000 }),
  ];
  const r = buildWeekendVsWeekday(queue, { generatedAt: GEN });
  assert.equal(r.totalModels, 2);
  assert.equal(r.models[0].model, 'claude-sonnet-4.5');
  assert.equal(r.models[0].totalTokens, 2000);
  assert.equal(r.models[1].model, 'gpt-5');
  assert.equal(r.models[1].totalTokens, 200);
  // each model: 50% weekend
  assert.equal(r.models[0].weekendShare, 0.5);
  assert.equal(r.models[1].weekendShare, 0.5);
});

// ---- dropped counters ------------------------------------------------------

test('weekend-vs-weekday: counts bad hour_start and zero tokens', () => {
  const queue = [
    ql('not-a-date', { total_tokens: 999 }),
    ql('2026-04-25T01:00:00Z', { total_tokens: 0 }),
    ql('2026-04-25T02:00:00Z', { total_tokens: -5 }),
    ql('2026-04-25T03:00:00Z', { total_tokens: 100 }),
  ];
  const r = buildWeekendVsWeekday(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.totalTokens, 100);
});

// ---- window filtering ------------------------------------------------------

test('weekend-vs-weekday: window since/until filters rows', () => {
  const queue = [
    ql('2026-04-25T01:00:00Z', { total_tokens: 100 }), // before
    ql('2026-04-27T01:00:00Z', { total_tokens: 200 }), // inside
    ql('2026-04-29T01:00:00Z', { total_tokens: 300 }), // after / boundary
  ];
  const r = buildWeekendVsWeekday(queue, {
    since: '2026-04-26T00:00:00Z',
    until: '2026-04-29T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.totalTokens, 200);
  assert.equal(r.weekdayTokens, 200);
  assert.equal(r.weekendTokens, 0);
});

// ---- minRows floor ---------------------------------------------------------

test('weekend-vs-weekday: minRows hides low-volume models', () => {
  const queue = [
    ql('2026-04-25T01:00:00Z', { model: 'gpt-5', total_tokens: 100 }),
    ql('2026-04-26T01:00:00Z', { model: 'gpt-5', total_tokens: 100 }),
    ql('2026-04-27T01:00:00Z', { model: 'gpt-5', total_tokens: 100 }),
    ql('2026-04-25T02:00:00Z', { model: 'rare-model', total_tokens: 50 }),
  ];
  const r = buildWeekendVsWeekday(queue, { minRows: 3, generatedAt: GEN });
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0].model, 'gpt-5');
  assert.equal(r.droppedMinRows, 1);
  // global totals still include the rare-model row
  assert.equal(r.totalTokens, 350);
});

// ---- top cap ---------------------------------------------------------------

test('weekend-vs-weekday: top cap truncates models[]', () => {
  const queue = [
    ql('2026-04-25T01:00:00Z', { model: 'a', total_tokens: 1000 }),
    ql('2026-04-25T02:00:00Z', { model: 'b', total_tokens: 500 }),
    ql('2026-04-25T03:00:00Z', { model: 'c', total_tokens: 100 }),
  ];
  const r = buildWeekendVsWeekday(queue, { top: 2, generatedAt: GEN });
  assert.equal(r.models.length, 2);
  assert.deepEqual(
    r.models.map((m) => m.model),
    ['a', 'b'],
  );
  assert.equal(r.droppedTopModels, 1);
});

// ---- sources tracking ------------------------------------------------------

test('weekend-vs-weekday: tracks distinct sources per model', () => {
  const queue = [
    ql('2026-04-25T01:00:00Z', { model: 'm', source: 'codex', total_tokens: 100 }),
    ql('2026-04-26T01:00:00Z', { model: 'm', source: 'claude-code', total_tokens: 100 }),
    ql('2026-04-27T01:00:00Z', { model: 'm', source: 'codex', total_tokens: 100 }),
  ];
  const r = buildWeekendVsWeekday(queue, { generatedAt: GEN });
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0].distinctSources, 2);
  assert.equal(r.models[0].weekendRows, 2);
  assert.equal(r.models[0].weekdayRows, 1);
});

// ---- firstSeen / lastSeen --------------------------------------------------

test('weekend-vs-weekday: firstSeen/lastSeen bracket activity', () => {
  const queue = [
    ql('2026-04-27T05:00:00Z', { model: 'm', total_tokens: 100 }),
    ql('2026-04-25T01:00:00Z', { model: 'm', total_tokens: 100 }),
    ql('2026-04-28T22:00:00Z', { model: 'm', total_tokens: 100 }),
  ];
  const r = buildWeekendVsWeekday(queue, { generatedAt: GEN });
  assert.equal(r.models[0].firstSeen, '2026-04-25T01:00:00Z');
  assert.equal(r.models[0].lastSeen, '2026-04-28T22:00:00Z');
});
