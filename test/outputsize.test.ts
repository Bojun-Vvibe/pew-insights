import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildOutputSize,
  DEFAULT_OUTPUT_SIZE_EDGES,
} from '../src/outputsize.js';
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

test('output-size: rejects bad minRows', () => {
  assert.throws(() => buildOutputSize([], { minRows: -1 }));
  assert.throws(() => buildOutputSize([], { minRows: 1.5 }));
  assert.throws(() => buildOutputSize([], { minRows: Number.NaN }));
});

test('output-size: rejects bad top', () => {
  assert.throws(() => buildOutputSize([], { top: -1 }));
  assert.throws(() => buildOutputSize([], { top: 2.5 }));
});

test('output-size: rejects bad atLeast', () => {
  assert.throws(() => buildOutputSize([], { atLeast: -1 }));
  assert.throws(() => buildOutputSize([], { atLeast: Number.NaN }));
});

test('output-size: rejects bad since/until', () => {
  assert.throws(() => buildOutputSize([], { since: 'no' }));
  assert.throws(() => buildOutputSize([], { until: 'nope' }));
});

test('output-size: rejects bad edges (empty / non-zero-first / non-monotonic / negative)', () => {
  assert.throws(() => buildOutputSize([], { edges: [] }));
  assert.throws(() => buildOutputSize([], { edges: [100] }));
  assert.throws(() => buildOutputSize([], { edges: [0, 100, 100] }));
  assert.throws(() => buildOutputSize([], { edges: [0, 100, 50] }));
  assert.throws(() => buildOutputSize([], { edges: [0, -1] }));
  assert.throws(() => buildOutputSize([], { edges: [0, Number.POSITIVE_INFINITY] }));
});

// ---- empty / shape ---------------------------------------------------------

test('output-size: empty input yields zero population but full edges ladder', () => {
  const r = buildOutputSize([], { generatedAt: GEN });
  assert.equal(r.consideredRows, 0);
  assert.equal(r.totalOutputTokens, 0);
  assert.equal(r.overallMeanOutputTokens, 0);
  assert.equal(r.overallMaxOutputTokens, 0);
  assert.equal(r.models.length, 0);
  assert.deepEqual(r.edges, DEFAULT_OUTPUT_SIZE_EDGES);
  assert.equal(r.overallBuckets.length, DEFAULT_OUTPUT_SIZE_EDGES.length);
  assert.ok(r.overallBuckets.every((b) => b.rows === 0 && b.share === 0));
});

// ---- bucketing -------------------------------------------------------------

test('output-size: rows fall into the right buckets and per-model stats are right', () => {
  // Defaults: 0, 256, 1k, 4k, 8k, 16k, 64k
  const queue = [
    ql('2026-04-20T00:00:00.000Z', 'claude-opus-4.7', { output_tokens: 100 }),    // 0–256
    ql('2026-04-20T01:00:00.000Z', 'claude-opus-4.7', { output_tokens: 500 }),    // 256–1k
    ql('2026-04-20T02:00:00.000Z', 'claude-opus-4.7', { output_tokens: 2_000 }),  // 1k–4k
    ql('2026-04-20T03:00:00.000Z', 'claude-opus-4.7', { output_tokens: 9_000 }),  // 8k–16k
    ql('2026-04-20T04:00:00.000Z', 'claude-opus-4.7', { output_tokens: 80_000 }), // 64k+
  ];
  const r = buildOutputSize(queue, { generatedAt: GEN });
  assert.equal(r.consideredRows, 5);
  assert.equal(r.totalOutputTokens, 91_600);
  assert.equal(r.overallMaxOutputTokens, 80_000);
  assert.equal(r.models.length, 1);
  const m = r.models[0]!;
  assert.equal(m.model, 'claude-opus-4.7');
  assert.equal(m.rows, 5);
  assert.equal(m.maxOutputTokens, 80_000);
  // Buckets: 1, 1, 1, 0, 1, 0, 1
  assert.deepEqual(
    m.buckets.map((b) => b.rows),
    [1, 1, 1, 0, 1, 0, 1],
  );
  // Mean = 91600/5 = 18320
  assert.equal(Math.round(m.meanOutputTokens), 18_320);
  // p95 nearest-rank with n=5: ceil(0.95*5)=5 -> idx 4 -> 80000
  assert.equal(m.p95OutputTokens, 80_000);
});

// ---- zero-output / invalid drops ------------------------------------------

test('output-size: drops zero-output and invalid token rows; surfaces both counters', () => {
  const queue = [
    ql('2026-04-20T00:00:00.000Z', 'gpt-5.4', { output_tokens: 500 }),
    ql('2026-04-20T01:00:00.000Z', 'gpt-5.4', { output_tokens: 0 }),
    ql('2026-04-20T02:00:00.000Z', 'gpt-5.4', { output_tokens: -3 as unknown as number }),
    ql('2026-04-20T03:00:00.000Z', 'gpt-5.4', { output_tokens: Number.NaN as unknown as number }),
    { ...ql('2026-04-20T04:00:00.000Z', 'gpt-5.4'), hour_start: 'not-a-date' },
  ];
  const r = buildOutputSize(queue, { generatedAt: GEN });
  assert.equal(r.consideredRows, 1);
  assert.equal(r.droppedZeroOutput, 1);
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalOutputTokens, 500);
});

// ---- atLeast ---------------------------------------------------------------

test('output-size: --at-least drops small completions BEFORE bucketing/mean/p95', () => {
  const queue = [
    ql('2026-04-20T00:00:00.000Z', 'claude-opus-4.7', { output_tokens: 100 }),
    ql('2026-04-20T01:00:00.000Z', 'claude-opus-4.7', { output_tokens: 200 }),
    ql('2026-04-20T02:00:00.000Z', 'claude-opus-4.7', { output_tokens: 9_000 }),
    ql('2026-04-20T03:00:00.000Z', 'claude-opus-4.7', { output_tokens: 12_000 }),
  ];
  const baseline = buildOutputSize(queue, { generatedAt: GEN });
  assert.equal(baseline.consideredRows, 4);
  assert.equal(Math.round(baseline.overallMeanOutputTokens), 5_325);
  assert.equal(baseline.droppedAtLeast, 0);

  const filtered = buildOutputSize(queue, { generatedAt: GEN, atLeast: 8_000 });
  assert.equal(filtered.consideredRows, 2);
  assert.equal(filtered.droppedAtLeast, 2);
  assert.equal(filtered.totalOutputTokens, 21_000);
  assert.equal(Math.round(filtered.overallMeanOutputTokens), 10_500);
  // No 0–256 / 256–1k / 1k–4k rows survive
  assert.equal(filtered.overallBuckets[0]!.rows, 0);
  assert.equal(filtered.overallBuckets[1]!.rows, 0);
  assert.equal(filtered.overallBuckets[2]!.rows, 0);
  assert.equal(filtered.atLeast, 8_000);
});

// ---- window composes with atLeast -----------------------------------------

test('output-size: window applied first, then atLeast', () => {
  const queue = [
    ql('2026-04-19T00:00:00.000Z', 'claude-opus-4.7', { output_tokens: 50_000 }), // outside window
    ql('2026-04-20T00:00:00.000Z', 'claude-opus-4.7', { output_tokens: 100 }),    // in window, below floor
    ql('2026-04-20T01:00:00.000Z', 'claude-opus-4.7', { output_tokens: 9_000 }),  // in window, above floor
  ];
  const r = buildOutputSize(queue, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-21T00:00:00.000Z',
    atLeast: 1_000,
  });
  assert.equal(r.consideredRows, 1);
  assert.equal(r.droppedAtLeast, 1); // only the in-window small row
  assert.equal(r.totalOutputTokens, 9_000);
});

// ---- top / minRows display filters ----------------------------------------

test('output-size: minRows hides thin models, surfaces droppedModelRows', () => {
  const queue = [
    ql('2026-04-20T00:00:00.000Z', 'claude-opus-4.7', { output_tokens: 500 }),
    ql('2026-04-20T01:00:00.000Z', 'claude-opus-4.7', { output_tokens: 600 }),
    ql('2026-04-20T02:00:00.000Z', 'claude-opus-4.7', { output_tokens: 700 }),
    ql('2026-04-20T03:00:00.000Z', 'gpt-5.4', { output_tokens: 200 }),
  ];
  const r = buildOutputSize(queue, { generatedAt: GEN, minRows: 2 });
  assert.equal(r.consideredRows, 4); // global denominator unchanged
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.model, 'claude-opus-4.7');
  assert.equal(r.droppedModelRows, 1);
});

test('output-size: top caps the kept models, surfaces droppedTopModels', () => {
  const queue = [
    ql('2026-04-20T00:00:00.000Z', 'claude-opus-4.7', { output_tokens: 500 }),
    ql('2026-04-20T00:00:00.000Z', 'claude-opus-4.7', { output_tokens: 500 }),
    ql('2026-04-20T01:00:00.000Z', 'gpt-5.4', { output_tokens: 600 }),
    ql('2026-04-20T02:00:00.000Z', 'gemini-3.0', { output_tokens: 700 }),
  ];
  const r = buildOutputSize(queue, { generatedAt: GEN, top: 1 });
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.model, 'claude-opus-4.7');
  assert.equal(r.droppedTopModels, 2);
});

// ---- determinism -----------------------------------------------------------

test('output-size: sort is stable: rows desc then model asc', () => {
  // Two models with identical row counts — model name should tie-break asc.
  const queue = [
    ql('2026-04-20T00:00:00.000Z', 'claude-opus-4.7', { output_tokens: 100 }),
    ql('2026-04-20T00:00:00.000Z', 'aaa-model', { output_tokens: 100 }),
  ];
  const r = buildOutputSize(queue, { generatedAt: GEN });
  assert.equal(r.models[0]!.model, 'aaa-model');
  assert.equal(r.models[1]!.model, 'claude-opus-4.7');
});

// ---- custom edges ----------------------------------------------------------

test('output-size: custom edges respected', () => {
  const queue = [
    ql('2026-04-20T00:00:00.000Z', 'm', { output_tokens: 50 }),
    ql('2026-04-20T00:00:00.000Z', 'm', { output_tokens: 150 }),
    ql('2026-04-20T00:00:00.000Z', 'm', { output_tokens: 1500 }),
  ];
  const r = buildOutputSize(queue, { generatedAt: GEN, edges: [0, 100, 1000] });
  assert.deepEqual(r.edges, [0, 100, 1000]);
  // Buckets: 0–100 (50), 100–1000 (150), 1000+ (1500)
  assert.deepEqual(
    r.overallBuckets.map((b) => b.rows),
    [1, 1, 1],
  );
});
