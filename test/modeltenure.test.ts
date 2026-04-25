import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildModelTenure } from '../src/modeltenure.js';
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

// ---- option validation ----------------------------------------------------

test('model-tenure: rejects bad since/until', () => {
  assert.throws(() => buildModelTenure([], { since: 'not-a-date' }));
  assert.throws(() => buildModelTenure([], { until: 'nope' }));
});

// ---- empty / drops --------------------------------------------------------

test('model-tenure: empty queue returns zeros', () => {
  const r = buildModelTenure([], { generatedAt: GEN });
  assert.equal(r.totalModels, 0);
  assert.equal(r.totalActiveBuckets, 0);
  assert.equal(r.totalTokens, 0);
  assert.deepEqual(r.models, []);
});

test('model-tenure: drops zero-token rows and bad hour_start', () => {
  const r = buildModelTenure(
    [
      ql('2026-04-20T01:00:00Z', { total_tokens: 0 }),
      ql('not-a-date', { total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { total_tokens: 500 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalActiveBuckets, 1);
  assert.equal(r.totalTokens, 500);
});

// ---- single-bucket model -------------------------------------------------

test('model-tenure: single-bucket model has spanHours == 0, tok/span-hr uses 1h floor', () => {
  const r = buildModelTenure(
    [ql('2026-04-20T05:00:00Z', { model: 'gpt-5', total_tokens: 100 })],
    { generatedAt: GEN },
  );
  assert.equal(r.models.length, 1);
  const m = r.models[0]!;
  assert.equal(m.spanHours, 0);
  assert.equal(m.activeBuckets, 1);
  assert.equal(m.tokens, 100);
  assert.equal(m.tokensPerActiveBucket, 100);
  assert.equal(m.tokensPerSpanHour, 100); // floored to 1h
  assert.equal(m.firstSeen, '2026-04-20T05:00:00.000Z');
  assert.equal(m.lastSeen, '2026-04-20T05:00:00.000Z');
});

// ---- spanHours is fractional / no inclusive +1 ---------------------------

test('model-tenure: spanHours measures clock hours first->last (no +1, may be fractional)', () => {
  const r = buildModelTenure(
    [
      ql('2026-04-20T00:00:00Z', { total_tokens: 100 }),
      ql('2026-04-20T10:30:00Z', { total_tokens: 200 }),
    ],
    { generatedAt: GEN },
  );
  const m = r.models[0]!;
  assert.equal(m.spanHours, 10.5);
  assert.equal(m.activeBuckets, 2);
  assert.equal(m.tokens, 300);
});

// ---- multi-model sorting -------------------------------------------------

test('model-tenure: sorts by spanHours desc, model asc tiebreak', () => {
  const r = buildModelTenure(
    [
      // model a: 4h span
      ql('2026-04-20T00:00:00Z', { model: 'a', total_tokens: 100 }),
      ql('2026-04-20T04:00:00Z', { model: 'a', total_tokens: 100 }),
      // model b: 9h span
      ql('2026-04-20T00:00:00Z', { model: 'b', total_tokens: 100 }),
      ql('2026-04-20T09:00:00Z', { model: 'b', total_tokens: 100 }),
      // model c: 4h span (tie with a)
      ql('2026-04-20T00:00:00Z', { model: 'c', total_tokens: 100 }),
      ql('2026-04-20T04:00:00Z', { model: 'c', total_tokens: 100 }),
    ],
    { generatedAt: GEN },
  );
  assert.deepEqual(
    r.models.map((m) => m.model),
    ['b', 'a', 'c'],
  );
  assert.equal(r.models[0]!.spanHours, 9);
  assert.equal(r.models[1]!.spanHours, 4);
  assert.equal(r.models[2]!.spanHours, 4);
});

// ---- multi-device aggregation does not double-count active buckets ------

test('model-tenure: same model+hour from multiple devices counts as one active bucket', () => {
  const r = buildModelTenure(
    [
      ql('2026-04-20T01:00:00Z', { device_id: 'dev-a', total_tokens: 300 }),
      ql('2026-04-20T01:00:00Z', { device_id: 'dev-b', total_tokens: 200 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.activeBuckets, 1);
  assert.equal(r.models[0]!.tokens, 500);
  assert.equal(r.models[0]!.spanHours, 0);
});

// ---- half-hour buckets are honored as distinct ---------------------------

test('model-tenure: half-hour hour_start values are distinct active buckets', () => {
  const r = buildModelTenure(
    [
      ql('2026-04-20T00:00:00Z', { total_tokens: 100 }),
      ql('2026-04-20T00:30:00Z', { total_tokens: 100 }),
      ql('2026-04-20T01:00:00Z', { total_tokens: 100 }),
    ],
    { generatedAt: GEN },
  );
  const m = r.models[0]!;
  assert.equal(m.activeBuckets, 3);
  assert.equal(m.spanHours, 1);
  // Sanity: activeBuckets can exceed spanHours when buckets are <1h apart.
  // This is expected and documented.
  assert.ok(m.activeBuckets > m.spanHours);
});

// ---- source filter -------------------------------------------------------

test('model-tenure: source filter excludes non-matching rows and counts them', () => {
  const r = buildModelTenure(
    [
      ql('2026-04-20T01:00:00Z', { source: 'codex', total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { source: 'cursor', total_tokens: 100 }),
      ql('2026-04-20T03:00:00Z', { source: 'codex', total_tokens: 100 }),
    ],
    { generatedAt: GEN, source: 'codex' },
  );
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.source, 'codex');
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.activeBuckets, 2);
  assert.equal(r.models[0]!.spanHours, 2);
});

// ---- since/until window --------------------------------------------------

test('model-tenure: since/until windowing trims firstSeen/lastSeen', () => {
  const r = buildModelTenure(
    [
      ql('2026-04-19T23:00:00Z', { total_tokens: 100 }),
      ql('2026-04-20T05:00:00Z', { total_tokens: 100 }),
      ql('2026-04-20T15:00:00Z', { total_tokens: 100 }),
      ql('2026-04-21T05:00:00Z', { total_tokens: 100 }),
    ],
    {
      generatedAt: GEN,
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
    },
  );
  const m = r.models[0]!;
  assert.equal(m.firstSeen, '2026-04-20T05:00:00.000Z');
  assert.equal(m.lastSeen, '2026-04-20T15:00:00.000Z');
  assert.equal(m.activeBuckets, 2);
  assert.equal(m.spanHours, 10);
});
