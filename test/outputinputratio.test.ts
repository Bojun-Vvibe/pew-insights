import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildOutputInputRatio } from '../src/outputinputratio.js';
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

test('output-input-ratio: rejects bad minRows', () => {
  assert.throws(() => buildOutputInputRatio([], { minRows: -1 }));
  assert.throws(() => buildOutputInputRatio([], { minRows: 1.5 }));
  assert.throws(() => buildOutputInputRatio([], { minRows: Number.NaN }));
});

test('output-input-ratio: rejects bad top', () => {
  assert.throws(() => buildOutputInputRatio([], { top: -1 }));
  assert.throws(() => buildOutputInputRatio([], { top: 2.5 }));
});

test('output-input-ratio: rejects bad since/until', () => {
  assert.throws(() => buildOutputInputRatio([], { since: 'no' }));
  assert.throws(() => buildOutputInputRatio([], { until: 'nope' }));
});

// ---- empty / dropped -------------------------------------------------------

test('output-input-ratio: empty input → empty report', () => {
  const r = buildOutputInputRatio([], { generatedAt: GEN });
  assert.equal(r.consideredRows, 0);
  assert.equal(r.totalInputTokens, 0);
  assert.equal(r.totalOutputTokens, 0);
  assert.equal(r.overallRatio, 0);
  assert.equal(r.models.length, 0);
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
  assert.equal(r.generatedAt, GEN);
});

test('output-input-ratio: drops bad hour_start, zero-input, and bad token rows', () => {
  const r = buildOutputInputRatio(
    [
      ql('not-iso', 'claude-opus-4.7'),
      ql('2026-04-20T01:00:00Z', 'claude-opus-4.7', { input_tokens: 0 }),
      ql('2026-04-20T02:00:00Z', 'claude-opus-4.7', { input_tokens: -1 }),
      ql('2026-04-20T03:00:00Z', 'claude-opus-4.7', {
        output_tokens: Number.NaN as unknown as number,
      }),
      ql('2026-04-20T04:00:00Z', 'claude-opus-4.7', { input_tokens: 100, output_tokens: 50 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroInput, 1);
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.consideredRows, 1);
  assert.equal(r.totalInputTokens, 100);
  assert.equal(r.totalOutputTokens, 50);
  assert.equal(r.overallRatio, 0.5);
});

// ---- core aggregation ------------------------------------------------------

test('output-input-ratio: per-model token-weighted ratio + mean-row-ratio, sorted by inputTokens desc', () => {
  const r = buildOutputInputRatio(
    [
      // claude-opus-4.7: in=1000+1000=2000, out=200+800=1000 → ratio 0.5
      // mean-row = (200/1000 + 800/1000) / 2 = (0.2 + 0.8)/2 = 0.5
      ql('2026-04-20T01:00:00Z', 'claude-opus-4.7', { input_tokens: 1000, output_tokens: 200 }),
      ql('2026-04-20T02:00:00Z', 'claude-opus-4.7', { input_tokens: 1000, output_tokens: 800 }),
      // gpt-5: in=5000, out=100 → ratio 0.02; mean-row = 0.02
      ql('2026-04-20T03:00:00Z', 'gpt-5', { input_tokens: 5000, output_tokens: 100 }),
      // haiku: in=200, out=400 → ratio 2.0; mean-row = 2.0
      ql('2026-04-20T04:00:00Z', 'claude-haiku-4.5', { input_tokens: 200, output_tokens: 400 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredRows, 4);
  assert.equal(r.totalInputTokens, 7200);
  assert.equal(r.totalOutputTokens, 1500);
  assert.ok(Math.abs(r.overallRatio - 1500 / 7200) < 1e-12);
  // sort: gpt-5 (5000) > claude-opus-4.7 (2000) > claude-haiku-4.5 (200)
  assert.deepEqual(
    r.models.map((m) => m.model),
    ['gpt-5', 'claude-opus-4.7', 'claude-haiku-4.5'],
  );
  const opus = r.models.find((m) => m.model === 'claude-opus-4.7')!;
  assert.equal(opus.rows, 2);
  assert.equal(opus.inputTokens, 2000);
  assert.equal(opus.outputTokens, 1000);
  assert.equal(opus.ratio, 0.5);
  assert.equal(opus.meanRowRatio, 0.5);
  assert.deepEqual(opus.bySource, {});

  const gpt = r.models.find((m) => m.model === 'gpt-5')!;
  assert.equal(gpt.ratio, 0.02);
  assert.equal(gpt.meanRowRatio, 0.02);

  const haiku = r.models.find((m) => m.model === 'claude-haiku-4.5')!;
  assert.equal(haiku.ratio, 2);
  assert.equal(haiku.meanRowRatio, 2);
});

// ---- window semantics ------------------------------------------------------

test('output-input-ratio: window since/until is exclusive on upper bound', () => {
  const r = buildOutputInputRatio(
    [
      ql('2026-04-19T00:00:00Z', 'm', { input_tokens: 1000, output_tokens: 100 }),
      ql('2026-04-20T00:00:00Z', 'm', { input_tokens: 1000, output_tokens: 200 }),
      ql('2026-04-21T00:00:00Z', 'm', { input_tokens: 1000, output_tokens: 300 }),
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
      generatedAt: GEN,
    },
  );
  assert.equal(r.consideredRows, 1);
  assert.equal(r.totalOutputTokens, 200);
  assert.equal(r.windowStart, '2026-04-20T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-21T00:00:00Z');
});

// ---- minRows / top filters -------------------------------------------------

test('output-input-ratio: minRows hides low-row models but keeps global denominators', () => {
  const r = buildOutputInputRatio(
    [
      ql('2026-04-20T01:00:00Z', 'big', { input_tokens: 1000, output_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', 'big', { input_tokens: 1000, output_tokens: 100 }),
      ql('2026-04-20T03:00:00Z', 'big', { input_tokens: 1000, output_tokens: 100 }),
      ql('2026-04-20T04:00:00Z', 'small', { input_tokens: 1000, output_tokens: 100 }),
    ],
    { minRows: 2, generatedAt: GEN },
  );
  // global denominator unchanged
  assert.equal(r.consideredRows, 4);
  assert.equal(r.totalInputTokens, 4000);
  // small model dropped from output
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.model, 'big');
  assert.equal(r.droppedModelRows, 1);
});

test('output-input-ratio: top cap truncates and surfaces droppedTopModels', () => {
  const r = buildOutputInputRatio(
    [
      ql('2026-04-20T01:00:00Z', 'a', { input_tokens: 4000, output_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', 'b', { input_tokens: 3000, output_tokens: 100 }),
      ql('2026-04-20T03:00:00Z', 'c', { input_tokens: 2000, output_tokens: 100 }),
      ql('2026-04-20T04:00:00Z', 'd', { input_tokens: 1000, output_tokens: 100 }),
    ],
    { top: 2, generatedAt: GEN },
  );
  assert.equal(r.models.length, 2);
  assert.deepEqual(
    r.models.map((m) => m.model),
    ['a', 'b'],
  );
  assert.equal(r.droppedTopModels, 2);
  // global denominator still reflects everything
  assert.equal(r.consideredRows, 4);
  assert.equal(r.totalInputTokens, 10000);
});

test('output-input-ratio: ratio of 0 when output is 0; mean-row-ratio matches', () => {
  const r = buildOutputInputRatio(
    [
      ql('2026-04-20T01:00:00Z', 'silent', { input_tokens: 1000, output_tokens: 0 }),
      ql('2026-04-20T02:00:00Z', 'silent', { input_tokens: 2000, output_tokens: 0 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.ratio, 0);
  assert.equal(r.models[0]!.meanRowRatio, 0);
  assert.equal(r.overallRatio, 0);
});

// ---- bySource refinement ---------------------------------------------------

test('output-input-ratio: bySource splits each model into per-source stats sorted by input desc', () => {
  const r = buildOutputInputRatio(
    [
      // claude-opus-4.7 from claude-code: in=1000, out=500 → ratio 0.5
      ql('2026-04-20T01:00:00Z', 'claude-opus-4.7', {
        source: 'claude-code',
        input_tokens: 1000,
        output_tokens: 500,
      }),
      // claude-opus-4.7 from opencode: in=4000, out=200 → ratio 0.05
      ql('2026-04-20T02:00:00Z', 'claude-opus-4.7', {
        source: 'opencode',
        input_tokens: 4000,
        output_tokens: 200,
      }),
    ],
    { bySource: true, generatedAt: GEN },
  );
  assert.equal(r.bySource, true);
  assert.equal(r.models.length, 1);
  const opus = r.models[0]!;
  // sources sorted by input desc: opencode (4000) > claude-code (1000)
  assert.deepEqual(Object.keys(opus.bySource), ['opencode', 'claude-code']);
  assert.equal(opus.bySource.opencode!.ratio, 0.05);
  assert.equal(opus.bySource['claude-code']!.ratio, 0.5);
  assert.equal(opus.bySource.opencode!.rows, 1);
  assert.equal(opus.bySource.opencode!.inputTokens, 4000);
  assert.equal(opus.bySource.opencode!.outputTokens, 200);
});

test('output-input-ratio: bySource defaults to false; bySource map is empty', () => {
  const r = buildOutputInputRatio(
    [
      ql('2026-04-20T01:00:00Z', 'm', { source: 'a', input_tokens: 100, output_tokens: 10 }),
      ql('2026-04-20T02:00:00Z', 'm', { source: 'b', input_tokens: 100, output_tokens: 10 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.bySource, false);
  assert.deepEqual(r.models[0]!.bySource, {});
});

test('output-input-ratio: bySource preserves global ratios identically vs default', () => {
  const lines: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', 'a', { source: 's1', input_tokens: 1000, output_tokens: 200 }),
    ql('2026-04-20T02:00:00Z', 'a', { source: 's2', input_tokens: 2000, output_tokens: 100 }),
    ql('2026-04-20T03:00:00Z', 'b', { source: 's1', input_tokens: 500, output_tokens: 50 }),
  ];
  const plain = buildOutputInputRatio(lines, { generatedAt: GEN });
  const split = buildOutputInputRatio(lines, { bySource: true, generatedAt: GEN });
  assert.equal(plain.consideredRows, split.consideredRows);
  assert.equal(plain.totalInputTokens, split.totalInputTokens);
  assert.equal(plain.totalOutputTokens, split.totalOutputTokens);
  assert.equal(plain.overallRatio, split.overallRatio);
  for (let i = 0; i < plain.models.length; i++) {
    assert.equal(plain.models[i]!.ratio, split.models[i]!.ratio);
    assert.equal(plain.models[i]!.meanRowRatio, split.models[i]!.meanRowRatio);
  }
});

test('output-input-ratio: bySource folds missing/empty source string into "unknown"', () => {
  const r = buildOutputInputRatio(
    [
      ql('2026-04-20T01:00:00Z', 'm', { source: '', input_tokens: 100, output_tokens: 10 }),
    ],
    { bySource: true, generatedAt: GEN },
  );
  assert.deepEqual(Object.keys(r.models[0]!.bySource), ['unknown']);
});
