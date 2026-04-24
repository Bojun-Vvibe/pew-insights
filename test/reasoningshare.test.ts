import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildReasoningShare } from '../src/reasoningshare.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, model: string, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'codex',
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

test('reasoning-share: rejects bad minRows', () => {
  assert.throws(() => buildReasoningShare([], { minRows: -1 }));
  assert.throws(() => buildReasoningShare([], { minRows: 1.5 }));
  assert.throws(() => buildReasoningShare([], { minRows: Number.NaN }));
});

test('reasoning-share: rejects bad top', () => {
  assert.throws(() => buildReasoningShare([], { top: -1 }));
  assert.throws(() => buildReasoningShare([], { top: 2.5 }));
});

test('reasoning-share: rejects bad since/until', () => {
  assert.throws(() => buildReasoningShare([], { since: 'no' }));
  assert.throws(() => buildReasoningShare([], { until: 'nope' }));
});

// ---- empty / dropped -------------------------------------------------------

test('reasoning-share: empty input → empty report', () => {
  const r = buildReasoningShare([], { generatedAt: GEN });
  assert.equal(r.consideredRows, 0);
  assert.equal(r.totalOutputTokens, 0);
  assert.equal(r.totalReasoningTokens, 0);
  assert.equal(r.totalGeneratedTokens, 0);
  assert.equal(r.overallReasoningShare, 0);
  assert.equal(r.models.length, 0);
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
});

test('reasoning-share: drops bad hour_start, zero-output, and bad token rows', () => {
  const r = buildReasoningShare(
    [
      ql('not-iso', 'gpt-5'),
      ql('2026-04-20T01:00:00Z', 'gpt-5', { output_tokens: 0, reasoning_output_tokens: 0 }),
      ql('2026-04-20T02:00:00Z', 'gpt-5', { output_tokens: -1 }),
      ql('2026-04-20T03:00:00Z', 'gpt-5', {
        reasoning_output_tokens: Number.NaN as unknown as number,
      }),
      ql('2026-04-20T04:00:00Z', 'gpt-5', { output_tokens: 100, reasoning_output_tokens: 400 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroOutput, 1);
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.consideredRows, 1);
  assert.equal(r.totalOutputTokens, 100);
  assert.equal(r.totalReasoningTokens, 400);
  assert.equal(r.totalGeneratedTokens, 500);
  assert.equal(r.overallReasoningShare, 0.8);
});

// ---- core aggregation ------------------------------------------------------

test('reasoning-share: per-model token-weighted shares, sorted by generated volume desc', () => {
  const r = buildReasoningShare(
    [
      ql('2026-04-20T01:00:00Z', 'gpt-5', { output_tokens: 100, reasoning_output_tokens: 900 }),
      ql('2026-04-20T02:00:00Z', 'gpt-5', { output_tokens: 200, reasoning_output_tokens: 800 }),
      ql('2026-04-20T03:00:00Z', 'gemini-3-pro-preview', {
        output_tokens: 5000,
        reasoning_output_tokens: 0,
      }),
      ql('2026-04-20T04:00:00Z', 'claude-haiku-4.5', {
        output_tokens: 50,
        reasoning_output_tokens: 50,
      }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredRows, 4);
  assert.equal(r.models.length, 3);
  // gemini wins on generated volume (5000) over gpt-5 (2000) and haiku (100)
  assert.equal(r.models[0]!.model, 'gemini-3-pro-preview');
  assert.equal(r.models[0]!.generatedTokens, 5000);
  assert.equal(r.models[0]!.reasoningShare, 0);
  assert.equal(r.models[1]!.model, 'gpt-5');
  assert.equal(r.models[1]!.generatedTokens, 2000);
  assert.equal(r.models[1]!.reasoningShare, 0.85); // 1700 / 2000
  assert.equal(r.models[2]!.model, 'claude-haiku-4.5');
  assert.equal(r.models[2]!.reasoningShare, 0.5);
  assert.equal(r.overallReasoningShare, 1750 / 7100);
});

// ---- minRows filter --------------------------------------------------------

test('reasoning-share: minRows hides low-row models without affecting global denom', () => {
  const r = buildReasoningShare(
    [
      ql('2026-04-20T01:00:00Z', 'gpt-5', { output_tokens: 100, reasoning_output_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', 'gpt-5', { output_tokens: 100, reasoning_output_tokens: 100 }),
      ql('2026-04-20T03:00:00Z', 'one-shot', { output_tokens: 1000, reasoning_output_tokens: 1000 }),
    ],
    { minRows: 2, generatedAt: GEN },
  );
  assert.equal(r.consideredRows, 3);
  assert.equal(r.totalGeneratedTokens, 2400);
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.model, 'gpt-5');
  assert.equal(r.droppedModelRows, 1);
});

// ---- window filter ---------------------------------------------------------

test('reasoning-share: since/until window filters by hour_start', () => {
  const r = buildReasoningShare(
    [
      ql('2026-04-19T23:00:00Z', 'gpt-5', { output_tokens: 100, reasoning_output_tokens: 100 }),
      ql('2026-04-20T00:00:00Z', 'gpt-5', { output_tokens: 100, reasoning_output_tokens: 300 }),
      ql('2026-04-20T05:00:00Z', 'gpt-5', { output_tokens: 100, reasoning_output_tokens: 100 }),
      ql('2026-04-20T06:00:00Z', 'gpt-5', { output_tokens: 100, reasoning_output_tokens: 100 }),
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-20T06:00:00Z',
      generatedAt: GEN,
    },
  );
  assert.equal(r.consideredRows, 2);
  assert.equal(r.totalReasoningTokens, 400);
  assert.equal(r.totalOutputTokens, 200);
  assert.equal(r.windowStart, '2026-04-20T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-20T06:00:00Z');
});

// ---- top filter ------------------------------------------------------------

test('reasoning-share: top truncates models[] but preserves global denom', () => {
  const r = buildReasoningShare(
    [
      ql('2026-04-20T01:00:00Z', 'gpt-5', { output_tokens: 1000, reasoning_output_tokens: 1000 }),
      ql('2026-04-20T02:00:00Z', 'gemini-3-pro-preview', {
        output_tokens: 500,
        reasoning_output_tokens: 500,
      }),
      ql('2026-04-20T03:00:00Z', 'claude-sonnet-4.5', {
        output_tokens: 100,
        reasoning_output_tokens: 100,
      }),
    ],
    { top: 1, generatedAt: GEN },
  );
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.model, 'gpt-5');
  assert.equal(r.droppedTopModels, 2);
  // global denom unaffected
  assert.equal(r.totalGeneratedTokens, 3200);
});

test('reasoning-share: top=0 means no cap, droppedTopModels stays 0', () => {
  const r = buildReasoningShare(
    [
      ql('2026-04-20T01:00:00Z', 'gpt-5', { output_tokens: 100, reasoning_output_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', 'gemini-3-pro-preview', {
        output_tokens: 50,
        reasoning_output_tokens: 50,
      }),
    ],
    { top: 0, generatedAt: GEN },
  );
  assert.equal(r.models.length, 2);
  assert.equal(r.droppedTopModels, 0);
});

test('reasoning-share: top combines with minRows correctly (minRows applied first)', () => {
  const r = buildReasoningShare(
    [
      // gpt-5: 2 rows, generated = 4000
      ql('2026-04-20T01:00:00Z', 'gpt-5', { output_tokens: 1000, reasoning_output_tokens: 1000 }),
      ql('2026-04-20T02:00:00Z', 'gpt-5', { output_tokens: 1000, reasoning_output_tokens: 1000 }),
      // single-row big spender — dropped by minRows even though it has the most volume
      ql('2026-04-20T03:00:00Z', 'one-shot-big', {
        output_tokens: 5000,
        reasoning_output_tokens: 5000,
      }),
      // gemini: 2 rows, generated = 1000
      ql('2026-04-20T04:00:00Z', 'gemini-3-pro-preview', {
        output_tokens: 250,
        reasoning_output_tokens: 250,
      }),
      ql('2026-04-20T05:00:00Z', 'gemini-3-pro-preview', {
        output_tokens: 250,
        reasoning_output_tokens: 250,
      }),
    ],
    { minRows: 2, top: 1, generatedAt: GEN },
  );
  // one-shot-big is dropped by minRows BEFORE top is applied
  assert.equal(r.droppedModelRows, 1);
  // then top=1 keeps just gpt-5 (heavier of the two survivors), drops gemini
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.model, 'gpt-5');
  assert.equal(r.droppedTopModels, 1);
});
