import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildBurstiness } from '../src/burstiness.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, model: string, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'codex',
    model,
    hour_start: hourStart,
    device_id: opts.device_id ?? 'dev',
    input_tokens: opts.input_tokens ?? 100,
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? 100,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: opts.total_tokens ?? 200,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation -----------------------------------------------------

test('burstiness: rejects bad minTokens', () => {
  assert.throws(() => buildBurstiness([], { minTokens: -1 }));
});

test('burstiness: rejects bad top', () => {
  assert.throws(() => buildBurstiness([], { top: -1 }));
  assert.throws(() => buildBurstiness([], { top: 2.5 }));
});

test('burstiness: rejects bad minActiveHours', () => {
  assert.throws(() => buildBurstiness([], { minActiveHours: 0 }));
  assert.throws(() => buildBurstiness([], { minActiveHours: 1.5 }));
});

test('burstiness: rejects bad since/until', () => {
  assert.throws(() => buildBurstiness([], { since: 'no' }));
  assert.throws(() => buildBurstiness([], { until: 'nope' }));
});

test('burstiness: rejects bad by', () => {
  // @ts-expect-error testing runtime guard
  assert.throws(() => buildBurstiness([], { by: 'project' }));
});

// ---- empty / shape ---------------------------------------------------------

test('burstiness: empty input yields zero population', () => {
  const r = buildBurstiness([], { generatedAt: GEN });
  assert.equal(r.totalTokens, 0);
  assert.deepEqual(r.groups, []);
  assert.equal(r.globalActiveHours, 0);
  assert.equal(r.globalCv, 0);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.by, 'model');
  assert.equal(r.minActiveHours, 1);
});

// ---- single hour: cv = 0, n=1 stable --------------------------------------

test('burstiness: single hour bucket gives cv=0 and burst=1×', () => {
  const rows = [ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: 500 })];
  const r = buildBurstiness(rows, { generatedAt: GEN });
  assert.equal(r.groups.length, 1);
  const g = r.groups[0]!;
  assert.equal(g.activeHours, 1);
  assert.equal(g.totalTokens, 500);
  assert.equal(g.meanTokensPerHour, 500);
  assert.equal(g.stddevTokensPerHour, 0);
  assert.equal(g.cv, 0);
  assert.equal(g.p50TokensPerHour, 500);
  assert.equal(g.p95TokensPerHour, 500);
  assert.equal(g.maxTokensPerHour, 500);
  assert.equal(g.burstRatio, 1);
});

// ---- uniform across hours: cv = 0 -----------------------------------------

test('burstiness: perfectly uniform hour buckets yield cv=0', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: 100 }),
    ql('2026-04-20T01:00:00.000Z', 'm', { total_tokens: 100 }),
    ql('2026-04-20T02:00:00.000Z', 'm', { total_tokens: 100 }),
    ql('2026-04-20T03:00:00.000Z', 'm', { total_tokens: 100 }),
  ];
  const r = buildBurstiness(rows, { generatedAt: GEN });
  const g = r.groups[0]!;
  assert.equal(g.activeHours, 4);
  assert.equal(g.meanTokensPerHour, 100);
  assert.equal(g.stddevTokensPerHour, 0);
  assert.equal(g.cv, 0);
  assert.equal(g.burstRatio, 1);
});

// ---- known cv arithmetic --------------------------------------------------

test('burstiness: known cv on values [10, 30] => mean=20, popstd=10, cv=0.5', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: 10 }),
    ql('2026-04-20T01:00:00.000Z', 'm', { total_tokens: 30 }),
  ];
  const r = buildBurstiness(rows, { generatedAt: GEN });
  const g = r.groups[0]!;
  assert.equal(g.activeHours, 2);
  assert.equal(g.meanTokensPerHour, 20);
  assert.equal(g.stddevTokensPerHour, 10);
  assert.ok(Math.abs(g.cv - 0.5) < 1e-9);
  // p50 of [10,30] linear = 20; max=30 -> burstRatio = 1.5
  assert.equal(g.p50TokensPerHour, 20);
  assert.equal(g.maxTokensPerHour, 30);
  assert.ok(Math.abs(g.burstRatio - 1.5) < 1e-9);
});

// ---- spike detection ------------------------------------------------------

test('burstiness: a single spike inflates cv and burstRatio', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: 100 }),
    ql('2026-04-20T01:00:00.000Z', 'm', { total_tokens: 100 }),
    ql('2026-04-20T02:00:00.000Z', 'm', { total_tokens: 100 }),
    ql('2026-04-20T03:00:00.000Z', 'm', { total_tokens: 10000 }),
  ];
  const r = buildBurstiness(rows, { generatedAt: GEN });
  const g = r.groups[0]!;
  assert.equal(g.activeHours, 4);
  assert.equal(g.maxTokensPerHour, 10000);
  // p50 of [100,100,100,10000] = 100; burst = 100×
  assert.equal(g.p50TokensPerHour, 100);
  assert.equal(g.burstRatio, 100);
  assert.ok(g.cv > 1.5, `expected cv > 1.5 for big spike, got ${g.cv}`);
});

// ---- bucketing: same hour_start aggregates --------------------------------

test('burstiness: rows sharing hour_start collapse into one bucket', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: 50 }),
    ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: 50 }),
    ql('2026-04-20T01:00:00.000Z', 'm', { total_tokens: 100 }),
  ];
  const r = buildBurstiness(rows, { generatedAt: GEN });
  const g = r.groups[0]!;
  assert.equal(g.activeHours, 2);
  assert.equal(g.totalTokens, 200);
  assert.equal(g.meanTokensPerHour, 100);
  assert.equal(g.cv, 0);
});

// ---- minActiveHours filter ------------------------------------------------

test('burstiness: minActiveHours hides sparse groups but preserves global denominators', () => {
  const rows = [
    // model "wide" with 3 hours
    ql('2026-04-20T00:00:00.000Z', 'wide', { total_tokens: 100 }),
    ql('2026-04-20T01:00:00.000Z', 'wide', { total_tokens: 200 }),
    ql('2026-04-20T02:00:00.000Z', 'wide', { total_tokens: 300 }),
    // model "thin" with 1 hour
    ql('2026-04-20T03:00:00.000Z', 'thin', { total_tokens: 999 }),
  ];
  const noFilter = buildBurstiness(rows, { generatedAt: GEN });
  assert.equal(noFilter.groups.length, 2);
  const filtered = buildBurstiness(rows, { generatedAt: GEN, minActiveHours: 2 });
  assert.equal(filtered.groups.length, 1);
  assert.equal(filtered.groups[0]!.model, 'wide');
  assert.equal(filtered.droppedSparseGroups, 1);
  // Global denominators untouched
  assert.equal(filtered.totalTokens, noFilter.totalTokens);
  assert.equal(filtered.globalActiveHours, noFilter.globalActiveHours);
});

// ---- minTokens filter ------------------------------------------------------

test('burstiness: minTokens hides low-volume groups', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'big', { total_tokens: 1000 }),
    ql('2026-04-20T01:00:00.000Z', 'big', { total_tokens: 1000 }),
    ql('2026-04-20T00:00:00.000Z', 'small', { total_tokens: 5 }),
    ql('2026-04-20T01:00:00.000Z', 'small', { total_tokens: 5 }),
  ];
  const r = buildBurstiness(rows, { generatedAt: GEN, minTokens: 100 });
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0]!.model, 'big');
  assert.equal(r.droppedGroupRows, 1);
});

// ---- top cap --------------------------------------------------------------

test('burstiness: top truncates to N largest groups by tokens', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', { total_tokens: 100 }),
    ql('2026-04-20T01:00:00.000Z', 'a', { total_tokens: 100 }),
    ql('2026-04-20T00:00:00.000Z', 'b', { total_tokens: 50 }),
    ql('2026-04-20T01:00:00.000Z', 'b', { total_tokens: 50 }),
    ql('2026-04-20T00:00:00.000Z', 'c', { total_tokens: 10 }),
    ql('2026-04-20T01:00:00.000Z', 'c', { total_tokens: 10 }),
  ];
  const r = buildBurstiness(rows, { generatedAt: GEN, top: 2 });
  assert.equal(r.groups.length, 2);
  assert.deepEqual(
    r.groups.map((g) => g.model),
    ['a', 'b'],
  );
  assert.equal(r.droppedTopGroups, 1);
});

// ---- by source dimension --------------------------------------------------

test('burstiness: by=source groups by source string', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'm1', { source: 'codex', total_tokens: 100 }),
    ql('2026-04-20T01:00:00.000Z', 'm2', { source: 'codex', total_tokens: 100 }),
    ql('2026-04-20T00:00:00.000Z', 'm1', { source: 'claude', total_tokens: 100 }),
  ];
  const r = buildBurstiness(rows, { generatedAt: GEN, by: 'source' });
  assert.equal(r.by, 'source');
  assert.equal(r.groups.length, 2);
  const codex = r.groups.find((g) => g.model === 'codex')!;
  assert.equal(codex.activeHours, 2);
  assert.equal(codex.totalTokens, 200);
});

// ---- since/until window ---------------------------------------------------

test('burstiness: since/until clamp the window', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: 100 }),
    ql('2026-04-20T01:00:00.000Z', 'm', { total_tokens: 100 }),
    ql('2026-04-20T02:00:00.000Z', 'm', { total_tokens: 100 }),
  ];
  const r = buildBurstiness(rows, {
    generatedAt: GEN,
    since: '2026-04-20T01:00:00.000Z',
    until: '2026-04-20T02:00:00.000Z',
  });
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0]!.activeHours, 1);
  assert.equal(r.totalTokens, 100);
  assert.equal(r.windowStart, '2026-04-20T01:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-20T02:00:00.000Z');
});

// ---- bad rows -------------------------------------------------------------

test('burstiness: bad hour_start and zero-tokens rows are counted, not crashed on', () => {
  const rows = [
    ql('not-an-iso', 'm', { total_tokens: 100 }),
    ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: 0 }),
    ql('2026-04-20T01:00:00.000Z', 'm', { total_tokens: -50 }),
    ql('2026-04-20T02:00:00.000Z', 'm', { total_tokens: 100 }),
  ];
  const r = buildBurstiness(rows, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.totalTokens, 100);
  assert.equal(r.groups.length, 1);
});

// ---- sort order -----------------------------------------------------------

test('burstiness: groups sorted by total tokens desc, key asc on ties', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'b', { total_tokens: 100 }),
    ql('2026-04-20T00:00:00.000Z', 'a', { total_tokens: 100 }),
    ql('2026-04-20T00:00:00.000Z', 'c', { total_tokens: 200 }),
  ];
  const r = buildBurstiness(rows, { generatedAt: GEN });
  assert.deepEqual(
    r.groups.map((g) => g.model),
    ['c', 'a', 'b'],
  );
});
