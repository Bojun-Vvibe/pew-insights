import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildCacheHitByHour } from '../src/cachehitbyhour.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'codex',
    model: opts.model ?? 'gpt-5',
    hour_start: hourStart,
    device_id: opts.device_id ?? 'dev',
    input_tokens: opts.input_tokens ?? 1000,
    cached_input_tokens: opts.cached_input_tokens ?? 500,
    output_tokens: opts.output_tokens ?? 100,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: opts.total_tokens ?? 1100,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation -----------------------------------------------------

test('cache-hit-by-hour: rejects bad minInputTokens', () => {
  assert.throws(() => buildCacheHitByHour([], { minInputTokens: -1 }));
});

test('cache-hit-by-hour: rejects bad topSources', () => {
  assert.throws(() => buildCacheHitByHour([], { topSources: -1 }));
  assert.throws(() => buildCacheHitByHour([], { topSources: 2.5 }));
});

test('cache-hit-by-hour: rejects bad since/until', () => {
  assert.throws(() => buildCacheHitByHour([], { since: 'no' }));
  assert.throws(() => buildCacheHitByHour([], { until: 'nope' }));
});

// ---- empty / shape ---------------------------------------------------------

test('cache-hit-by-hour: empty input yields zero population with 24 buckets', () => {
  const r = buildCacheHitByHour([], { generatedAt: GEN });
  assert.equal(r.totalInputTokens, 0);
  assert.equal(r.totalCachedInputTokens, 0);
  assert.equal(r.globalCacheRatio, 0);
  assert.equal(r.byHour.length, 24);
  for (let h = 0; h < 24; h += 1) {
    assert.equal(r.byHour[h].hour, h);
    assert.equal(r.byHour[h].inputTokens, 0);
    assert.equal(r.byHour[h].rows, 0);
  }
  assert.deepEqual(r.bySource, []);
  assert.equal(r.generatedAt, GEN);
});

// ---- hour bucketing --------------------------------------------------------

test('cache-hit-by-hour: buckets rows by UTC hour-of-day', () => {
  const rows: QueueLine[] = [
    ql('2026-04-20T09:00:00.000Z', { input_tokens: 1000, cached_input_tokens: 800 }),
    ql('2026-04-21T09:00:00.000Z', { input_tokens: 2000, cached_input_tokens: 1000 }), // ratio 1800/3000 = 0.6
    ql('2026-04-20T22:00:00.000Z', { input_tokens: 100, cached_input_tokens: 10 }), // 0.10
  ];
  const r = buildCacheHitByHour(rows, { generatedAt: GEN });
  assert.equal(r.byHour[9].inputTokens, 3000);
  assert.equal(r.byHour[9].cachedInputTokens, 1800);
  assert.ok(Math.abs(r.byHour[9].cacheRatio - 0.6) < 1e-9);
  assert.equal(r.byHour[9].rows, 2);
  assert.equal(r.byHour[22].inputTokens, 100);
  assert.equal(r.byHour[22].cachedInputTokens, 10);
  assert.ok(Math.abs(r.byHour[22].cacheRatio - 0.1) < 1e-9);
  assert.equal(r.totalInputTokens, 3100);
  assert.equal(r.totalCachedInputTokens, 1810);
  // hours that didn't get any rows have zero ratio
  assert.equal(r.byHour[0].cacheRatio, 0);
  assert.equal(r.byHour[0].rows, 0);
});

// ---- per-source peak/trough ------------------------------------------------

test('cache-hit-by-hour: per-source peak and trough hour computed across hours with input', () => {
  const rows: QueueLine[] = [
    ql('2026-04-20T09:00:00.000Z', { source: 'codex', input_tokens: 1000, cached_input_tokens: 900 }), // 0.90
    ql('2026-04-20T13:00:00.000Z', { source: 'codex', input_tokens: 1000, cached_input_tokens: 200 }), // 0.20
    ql('2026-04-20T18:00:00.000Z', { source: 'codex', input_tokens: 500, cached_input_tokens: 250 }),  // 0.50
    ql('2026-04-20T09:00:00.000Z', { source: 'claude-code', input_tokens: 1000, cached_input_tokens: 500 }),
  ];
  const r = buildCacheHitByHour(rows, { generatedAt: GEN });
  const codex = r.bySource.find((s) => s.source === 'codex')!;
  assert.equal(codex.peakHour, 9);
  assert.ok(Math.abs(codex.peakRatio - 0.9) < 1e-9);
  assert.equal(codex.troughHour, 13);
  assert.ok(Math.abs(codex.troughRatio - 0.2) < 1e-9);
  assert.ok(Math.abs(codex.spread - 0.7) < 1e-9);
  assert.equal(codex.byHour.length, 24);
  // sorted by inputTokens desc
  assert.equal(r.bySource[0].source, 'codex');
  assert.equal(r.bySource[1].source, 'claude-code');
});

// ---- dropped accounting ----------------------------------------------------

test('cache-hit-by-hour: drops bad hour_start and zero-input rows', () => {
  const rows: QueueLine[] = [
    ql('not-a-date'),
    ql('2026-04-20T09:00:00.000Z', { input_tokens: 0 }),
    ql('2026-04-20T09:00:00.000Z', { input_tokens: -5 }),
    ql('2026-04-20T09:00:00.000Z', { input_tokens: 100, cached_input_tokens: 50 }),
  ];
  const r = buildCacheHitByHour(rows, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroInput, 2);
  assert.equal(r.totalInputTokens, 100);
  assert.equal(r.totalCachedInputTokens, 50);
});

// ---- cached clamped to input ----------------------------------------------

test('cache-hit-by-hour: cached_input_tokens clamped to input_tokens', () => {
  const rows: QueueLine[] = [
    ql('2026-04-20T09:00:00.000Z', { input_tokens: 100, cached_input_tokens: 500 }),
  ];
  const r = buildCacheHitByHour(rows, { generatedAt: GEN });
  assert.equal(r.totalInputTokens, 100);
  assert.equal(r.totalCachedInputTokens, 100);
  assert.equal(r.globalCacheRatio, 1);
});

// ---- window filter ---------------------------------------------------------

test('cache-hit-by-hour: since inclusive, until exclusive', () => {
  const rows: QueueLine[] = [
    ql('2026-04-20T09:00:00.000Z', { input_tokens: 100, cached_input_tokens: 10 }),
    ql('2026-04-21T09:00:00.000Z', { input_tokens: 100, cached_input_tokens: 50 }),
    ql('2026-04-22T09:00:00.000Z', { input_tokens: 100, cached_input_tokens: 90 }),
  ];
  const r = buildCacheHitByHour(rows, {
    generatedAt: GEN,
    since: '2026-04-21T00:00:00.000Z',
    until: '2026-04-22T00:00:00.000Z',
  });
  assert.equal(r.totalInputTokens, 100);
  assert.equal(r.totalCachedInputTokens, 50);
});

// ---- min-input + top -------------------------------------------------------

test('cache-hit-by-hour: minInputTokens hides small sources without affecting global', () => {
  const rows: QueueLine[] = [
    ql('2026-04-20T09:00:00.000Z', { source: 'big', input_tokens: 10000, cached_input_tokens: 5000 }),
    ql('2026-04-20T09:00:00.000Z', { source: 'tiny', input_tokens: 50, cached_input_tokens: 10 }),
  ];
  const r = buildCacheHitByHour(rows, { generatedAt: GEN, minInputTokens: 100 });
  assert.equal(r.totalSources, 2);
  assert.equal(r.bySource.length, 1);
  assert.equal(r.bySource[0].source, 'big');
  assert.equal(r.droppedMinInputTokens, 1);
  assert.equal(r.totalInputTokens, 10050);
});

test('cache-hit-by-hour: topSources truncates and counts dropped', () => {
  const rows: QueueLine[] = [
    ql('2026-04-20T09:00:00.000Z', { source: 'a', input_tokens: 300 }),
    ql('2026-04-20T09:00:00.000Z', { source: 'b', input_tokens: 200 }),
    ql('2026-04-20T09:00:00.000Z', { source: 'c', input_tokens: 100 }),
  ];
  const r = buildCacheHitByHour(rows, { generatedAt: GEN, topSources: 2 });
  assert.equal(r.bySource.length, 2);
  assert.equal(r.bySource[0].source, 'a');
  assert.equal(r.bySource[1].source, 'b');
  assert.equal(r.droppedTopSources, 1);
});

test('cache-hit-by-hour: missing source falls back to "unknown"', () => {
  const rows: QueueLine[] = [
    ql('2026-04-20T09:00:00.000Z', { source: '' as unknown as string }),
  ];
  const r = buildCacheHitByHour(rows, { generatedAt: GEN });
  assert.equal(r.bySource[0].source, 'unknown');
});

// ---- --source filter -------------------------------------------------------

test('cache-hit-by-hour: source filter restricts totals and bySource', () => {
  const rows: QueueLine[] = [
    ql('2026-04-20T09:00:00.000Z', { source: 'codex', input_tokens: 1000, cached_input_tokens: 800 }),
    ql('2026-04-20T13:00:00.000Z', { source: 'codex', input_tokens: 500, cached_input_tokens: 250 }),
    ql('2026-04-20T09:00:00.000Z', { source: 'other', input_tokens: 9000, cached_input_tokens: 100 }),
  ];
  const r = buildCacheHitByHour(rows, { generatedAt: GEN, source: 'codex' });
  assert.equal(r.sourceFilter, 'codex');
  assert.equal(r.totalInputTokens, 1500);
  assert.equal(r.totalCachedInputTokens, 1050);
  assert.equal(r.bySource.length, 1);
  assert.equal(r.bySource[0].source, 'codex');
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedSourceFilter, 1);
  // Other source's hour bucket should not contaminate the global byHour
  assert.equal(r.byHour[9].inputTokens, 1000);
  assert.equal(r.byHour[9].cachedInputTokens, 800);
});

test('cache-hit-by-hour: source filter null/empty disables filter', () => {
  const rows: QueueLine[] = [
    ql('2026-04-20T09:00:00.000Z', { source: 'codex' }),
    ql('2026-04-20T09:00:00.000Z', { source: 'other' }),
  ];
  const r1 = buildCacheHitByHour(rows, { generatedAt: GEN, source: null });
  assert.equal(r1.sourceFilter, null);
  assert.equal(r1.bySource.length, 2);
  assert.equal(r1.droppedSourceFilter, 0);
  const r2 = buildCacheHitByHour(rows, { generatedAt: GEN, source: '' });
  assert.equal(r2.sourceFilter, null);
  assert.equal(r2.bySource.length, 2);
});

test('cache-hit-by-hour: source filter with no matches yields empty byHour', () => {
  const rows: QueueLine[] = [
    ql('2026-04-20T09:00:00.000Z', { source: 'codex' }),
  ];
  const r = buildCacheHitByHour(rows, { generatedAt: GEN, source: 'missing' });
  assert.equal(r.totalInputTokens, 0);
  assert.equal(r.bySource.length, 0);
  assert.equal(r.droppedSourceFilter, 1);
});
