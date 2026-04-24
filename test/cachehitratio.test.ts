import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildCacheHitRatio } from '../src/cachehitratio.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, model: string, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'claude-code',
    model,
    hour_start: hourStart,
    device_id: opts.device_id ?? 'dev',
    input_tokens: opts.input_tokens ?? 1000,
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? 100,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: opts.total_tokens ?? 1100,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation -----------------------------------------------------

test('cache-hit-ratio: rejects bad minRows', () => {
  assert.throws(() => buildCacheHitRatio([], { minRows: -1 }));
  assert.throws(() => buildCacheHitRatio([], { minRows: 1.5 }));
  assert.throws(() => buildCacheHitRatio([], { minRows: Number.NaN }));
});

test('cache-hit-ratio: rejects bad since/until', () => {
  assert.throws(() => buildCacheHitRatio([], { since: 'no' }));
  assert.throws(() => buildCacheHitRatio([], { until: 'nope' }));
});

// ---- empty / dropped -------------------------------------------------------

test('cache-hit-ratio: empty input → empty report', () => {
  const r = buildCacheHitRatio([], { generatedAt: GEN });
  assert.equal(r.consideredRows, 0);
  assert.equal(r.totalInputTokens, 0);
  assert.equal(r.totalCachedInputTokens, 0);
  assert.equal(r.overallHitRatio, 0);
  assert.equal(r.models.length, 0);
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
});

test('cache-hit-ratio: drops bad hour_start, zero-input, and bad token rows', () => {
  const r = buildCacheHitRatio(
    [
      ql('not-iso', 'claude-opus-4.7'),
      ql('2026-04-20T01:00:00Z', 'claude-opus-4.7', { input_tokens: 0, cached_input_tokens: 0 }),
      ql('2026-04-20T02:00:00Z', 'claude-opus-4.7', { input_tokens: -1 }),
      ql('2026-04-20T03:00:00Z', 'claude-opus-4.7', {
        cached_input_tokens: Number.NaN as unknown as number,
      }),
      ql('2026-04-20T04:00:00Z', 'claude-opus-4.7', { input_tokens: 100, cached_input_tokens: 80 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroInput, 1);
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.consideredRows, 1);
  assert.equal(r.totalInputTokens, 100);
  assert.equal(r.totalCachedInputTokens, 80);
  assert.equal(r.overallHitRatio, 0.8);
});

// ---- core aggregation ------------------------------------------------------

test('cache-hit-ratio: per-model token-weighted ratios, sorted by inputTokens desc', () => {
  const r = buildCacheHitRatio(
    [
      ql('2026-04-20T01:00:00Z', 'claude-opus-4.7', { input_tokens: 1000, cached_input_tokens: 900 }),
      ql('2026-04-20T02:00:00Z', 'claude-opus-4.7', { input_tokens: 1000, cached_input_tokens: 700 }),
      ql('2026-04-20T03:00:00Z', 'gpt-5', { input_tokens: 5000, cached_input_tokens: 1000 }),
      ql('2026-04-20T04:00:00Z', 'claude-haiku-4.5', { input_tokens: 200, cached_input_tokens: 50 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredRows, 4);
  assert.equal(r.totalInputTokens, 7200);
  assert.equal(r.totalCachedInputTokens, 2650);
  // overall: 2650/7200 ≈ 0.3680...
  assert.ok(Math.abs(r.overallHitRatio - 2650 / 7200) < 1e-12);
  // sort: gpt-5 (5000) > claude-opus-4.7 (2000) > claude-haiku-4.5 (200)
  assert.deepEqual(
    r.models.map((m) => m.model),
    ['gpt-5', 'claude-opus-4.7', 'claude-haiku-4.5'],
  );
  const opus = r.models.find((m) => m.model === 'claude-opus-4.7')!;
  assert.equal(opus.rows, 2);
  assert.equal(opus.inputTokens, 2000);
  assert.equal(opus.cachedInputTokens, 1600);
  assert.equal(opus.hitRatio, 0.8);
});

test('cache-hit-ratio: window since/until is exclusive on upper bound', () => {
  const r = buildCacheHitRatio(
    [
      ql('2026-04-19T23:59:59Z', 'claude-opus-4.7'), // dropped
      ql('2026-04-20T00:00:00Z', 'claude-opus-4.7', { input_tokens: 100, cached_input_tokens: 50 }),
      ql('2026-04-21T00:00:00Z', 'claude-opus-4.7'), // dropped (== until)
    ],
    { since: '2026-04-20T00:00:00Z', until: '2026-04-21T00:00:00Z', generatedAt: GEN },
  );
  assert.equal(r.consideredRows, 1);
  assert.equal(r.windowStart, '2026-04-20T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-21T00:00:00Z');
});

test('cache-hit-ratio: deterministic ordering — input-volume tie breaks on model asc', () => {
  const r = buildCacheHitRatio(
    [
      ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 100, cached_input_tokens: 10 }),
      ql('2026-04-20T02:00:00Z', 'claude-opus-4.7', { input_tokens: 100, cached_input_tokens: 90 }),
      ql('2026-04-20T03:00:00Z', 'gemini-2.5-pro', { input_tokens: 100, cached_input_tokens: 0 }),
    ],
    { generatedAt: GEN },
  );
  assert.deepEqual(
    r.models.map((m) => m.model),
    ['claude-opus-4.7', 'gemini-2.5-pro', 'gpt-5'],
  );
});

test('cache-hit-ratio: model normalisation collapses dashed/dotted variants', () => {
  const r = buildCacheHitRatio(
    [
      ql('2026-04-20T01:00:00Z', 'claude-opus-4-7', { input_tokens: 100, cached_input_tokens: 50 }),
      ql('2026-04-20T02:00:00Z', 'claude-opus-4.7', { input_tokens: 100, cached_input_tokens: 30 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.model, 'claude-opus-4.7');
  assert.equal(r.models[0]!.rows, 2);
  assert.equal(r.models[0]!.inputTokens, 200);
  assert.equal(r.models[0]!.cachedInputTokens, 80);
});

test('cache-hit-ratio: minRows hides small models but keeps global denominators', () => {
  const r = buildCacheHitRatio(
    [
      ql('2026-04-20T01:00:00Z', 'claude-opus-4.7', { input_tokens: 1000, cached_input_tokens: 500 }),
      ql('2026-04-20T02:00:00Z', 'claude-opus-4.7', { input_tokens: 1000, cached_input_tokens: 700 }),
      ql('2026-04-20T03:00:00Z', 'gpt-5', { input_tokens: 100, cached_input_tokens: 10 }),
    ],
    { generatedAt: GEN, minRows: 2 },
  );
  assert.equal(r.minRows, 2);
  assert.deepEqual(r.models.map((m) => m.model), ['claude-opus-4.7']);
  assert.equal(r.droppedModelRows, 1);
  // global denominators unchanged
  assert.equal(r.consideredRows, 3);
  assert.equal(r.totalInputTokens, 2100);
  assert.equal(r.totalCachedInputTokens, 1210);
});

test('cache-hit-ratio: report echoes window/minRows', () => {
  const r = buildCacheHitRatio([], {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00Z',
    until: '2026-05-01T00:00:00Z',
    minRows: 5,
  });
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.windowStart, '2026-04-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00Z');
  assert.equal(r.minRows, 5);
});

// ---- by-source breakdown (0.4.34) -----------------------------------------

test('cache-hit-ratio: bySource off (default) → bySource is empty object on every model', () => {
  const r = buildCacheHitRatio(
    [
      ql('2026-04-20T01:00:00Z', 'claude-opus-4.7', { input_tokens: 100, cached_input_tokens: 50, source: 'opencode' }),
      ql('2026-04-20T02:00:00Z', 'claude-opus-4.7', { input_tokens: 100, cached_input_tokens: 80, source: 'claude-code' }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.bySource, false);
  assert.deepEqual(r.models[0]!.bySource, {});
});

test('cache-hit-ratio: bySource on → per-source rows/tokens/ratio populated and sorted by input desc', () => {
  const r = buildCacheHitRatio(
    [
      ql('2026-04-20T01:00:00Z', 'claude-opus-4.7', { input_tokens: 100, cached_input_tokens: 50, source: 'opencode' }),
      ql('2026-04-20T02:00:00Z', 'claude-opus-4.7', { input_tokens: 300, cached_input_tokens: 240, source: 'claude-code' }),
      ql('2026-04-20T03:00:00Z', 'claude-opus-4.7', { input_tokens: 300, cached_input_tokens: 60, source: 'claude-code' }),
    ],
    { generatedAt: GEN, bySource: true },
  );
  assert.equal(r.bySource, true);
  const m = r.models[0]!;
  const keys = Object.keys(m.bySource);
  // claude-code total input = 600, opencode = 100 → claude-code first
  assert.deepEqual(keys, ['claude-code', 'opencode']);
  const cc = m.bySource['claude-code']!;
  assert.equal(cc.rows, 2);
  assert.equal(cc.inputTokens, 600);
  assert.equal(cc.cachedInputTokens, 300);
  assert.equal(cc.hitRatio, 0.5);
  const oc = m.bySource['opencode']!;
  assert.equal(oc.rows, 1);
  assert.equal(oc.inputTokens, 100);
  assert.equal(oc.cachedInputTokens, 50);
  assert.equal(oc.hitRatio, 0.5);
});

test('cache-hit-ratio: bySource folds missing/empty source into "unknown"', () => {
  const r = buildCacheHitRatio(
    [
      ql('2026-04-20T01:00:00Z', 'claude-opus-4.7', { input_tokens: 100, cached_input_tokens: 10, source: '' }),
    ],
    { generatedAt: GEN, bySource: true },
  );
  const m = r.models[0]!;
  assert.deepEqual(Object.keys(m.bySource), ['unknown']);
  assert.equal(m.bySource['unknown']!.rows, 1);
});

// ---- top cap (0.4.35) -----------------------------------------------------

test('cache-hit-ratio: rejects bad top', () => {
  assert.throws(() => buildCacheHitRatio([], { top: -1 }));
  assert.throws(() => buildCacheHitRatio([], { top: 1.5 }));
});

test('cache-hit-ratio: top truncates kept models and surfaces droppedTopModels', () => {
  const r = buildCacheHitRatio(
    [
      ql('2026-04-20T01:00:00Z', 'claude-opus-4.7', { input_tokens: 5000, cached_input_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', 'gpt-5', { input_tokens: 3000, cached_input_tokens: 100 }),
      ql('2026-04-20T03:00:00Z', 'gemini-2.5-pro', { input_tokens: 1000, cached_input_tokens: 100 }),
      ql('2026-04-20T04:00:00Z', 'claude-haiku-4.5', { input_tokens: 100, cached_input_tokens: 10 }),
    ],
    { generatedAt: GEN, top: 2 },
  );
  assert.equal(r.top, 2);
  assert.deepEqual(r.models.map((m) => m.model), ['claude-opus-4.7', 'gpt-5']);
  assert.equal(r.droppedTopModels, 2);
  // global totals unchanged
  assert.equal(r.consideredRows, 4);
  assert.equal(r.totalInputTokens, 9100);
});

test('cache-hit-ratio: top=0 (default) is no-op', () => {
  const r = buildCacheHitRatio(
    [
      ql('2026-04-20T01:00:00Z', 'claude-opus-4.7'),
      ql('2026-04-20T02:00:00Z', 'gpt-5'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.top, 0);
  assert.equal(r.droppedTopModels, 0);
  assert.equal(r.models.length, 2);
});
