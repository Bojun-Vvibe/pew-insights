import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildModelMixEntropy } from '../src/modelmixentropy.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hourStart: string,
  source: string,
  model: string,
  totalTokens: number,
): QueueLine {
  return {
    source,
    model,
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: Math.floor(totalTokens * 0.9),
    cached_input_tokens: 0,
    output_tokens: Math.floor(totalTokens * 0.1),
    reasoning_output_tokens: 0,
    total_tokens: totalTokens,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation -----------------------------------------------------

test('model-mix-entropy: rejects bad minTokens', () => {
  assert.throws(() => buildModelMixEntropy([], { minTokens: -1 }));
  assert.throws(() => buildModelMixEntropy([], { minTokens: Number.NaN }));
});

test('model-mix-entropy: rejects bad since/until', () => {
  assert.throws(() => buildModelMixEntropy([], { since: 'no' }));
  assert.throws(() => buildModelMixEntropy([], { until: 'nope' }));
});

// ---- empty / dropped -------------------------------------------------------

test('model-mix-entropy: empty input → empty report', () => {
  const r = buildModelMixEntropy([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
  assert.equal(r.generatedAt, GEN);
});

test('model-mix-entropy: drops bad hour_start and zero/non-finite tokens', () => {
  const r = buildModelMixEntropy(
    [
      ql('not-iso', 's', 'm', 100),
      ql('2026-04-20T01:00:00Z', 's', 'm', 0),
      ql('2026-04-20T02:00:00Z', 's', 'm', Number.NaN as unknown as number),
      ql('2026-04-20T03:00:00Z', 's', 'm', 100),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources[0]!.totalTokens, 100);
});

// ---- entropy math ----------------------------------------------------------

test('model-mix-entropy: single model → entropy 0, effective 1, topShare 1', () => {
  const r = buildModelMixEntropy(
    [
      ql('2026-04-20T01:00:00Z', 'codex', 'ma', 100),
      ql('2026-04-20T02:00:00Z', 'codex', 'ma', 200),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.distinctModels, 1);
  assert.equal(row.entropyBits, 0);
  assert.equal(row.maxEntropyBits, 0);
  assert.equal(row.normalizedEntropy, 0);
  assert.equal(row.effectiveModels, 1);
  assert.equal(row.topModelShare, 1);
  assert.equal(row.topModel, 'ma');
});

test('model-mix-entropy: even 2-model split → entropy 1 bit, effective 2, normalized 1', () => {
  const r = buildModelMixEntropy(
    [
      ql('2026-04-20T01:00:00Z', 'codex', 'ma', 100),
      ql('2026-04-20T02:00:00Z', 'codex', 'mb', 100),
    ],
    { generatedAt: GEN },
  );
  const row = r.sources[0]!;
  assert.equal(row.distinctModels, 2);
  assert.ok(Math.abs(row.entropyBits - 1) < 1e-9);
  assert.ok(Math.abs(row.maxEntropyBits - 1) < 1e-9);
  assert.ok(Math.abs(row.normalizedEntropy - 1) < 1e-9);
  assert.ok(Math.abs(row.effectiveModels - 2) < 1e-9);
  assert.equal(row.topModelShare, 0.5);
});

test('model-mix-entropy: 4-model perfectly even → entropy 2 bits, effective 4', () => {
  const r = buildModelMixEntropy(
    [
      ql('2026-04-20T01:00:00Z', 'codex', 'm1', 100),
      ql('2026-04-20T02:00:00Z', 'codex', 'm2', 100),
      ql('2026-04-20T03:00:00Z', 'codex', 'm3', 100),
      ql('2026-04-20T04:00:00Z', 'codex', 'm4', 100),
    ],
    { generatedAt: GEN },
  );
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.entropyBits - 2) < 1e-9);
  assert.ok(Math.abs(row.effectiveModels - 4) < 1e-9);
  assert.ok(Math.abs(row.normalizedEntropy - 1) < 1e-9);
});

test('model-mix-entropy: skewed mix → entropy < max, normalized < 1', () => {
  // 90% mA + 10% mB: H = -.9 log2 .9 -.1 log2 .1 ≈ 0.469
  const r = buildModelMixEntropy(
    [
      ql('2026-04-20T01:00:00Z', 'codex', 'ma', 900),
      ql('2026-04-20T02:00:00Z', 'codex', 'mb', 100),
    ],
    { generatedAt: GEN },
  );
  const row = r.sources[0]!;
  assert.ok(row.entropyBits > 0.4 && row.entropyBits < 0.5);
  assert.ok(row.normalizedEntropy < 0.5);
  assert.equal(row.topModel, 'ma');
  assert.ok(Math.abs(row.topModelShare - 0.9) < 1e-9);
});

// ---- per-source aggregation + sort -----------------------------------------

test('model-mix-entropy: separates sources, sorts by total tokens desc', () => {
  const r = buildModelMixEntropy(
    [
      ql('2026-04-20T01:00:00Z', 'codex', 'ma', 500),
      ql('2026-04-20T02:00:00Z', 'codex', 'ma', 500),
      ql('2026-04-20T03:00:00Z', 'gemini-cli', 'mc', 100),
      ql('2026-04-20T04:00:00Z', 'gemini-cli', 'md', 100),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'codex');
  assert.equal(r.sources[0]!.totalTokens, 1000);
  assert.equal(r.sources[1]!.source, 'gemini-cli');
  assert.equal(r.sources[1]!.totalTokens, 200);
});

test('model-mix-entropy: empty source string folds into "unknown"', () => {
  const r = buildModelMixEntropy(
    [ql('2026-04-20T01:00:00Z', '', 'ma', 100)],
    { generatedAt: GEN },
  );
  assert.equal(r.sources[0]!.source, 'unknown');
});

// ---- minTokens floor -------------------------------------------------------

test('model-mix-entropy: minTokens hides small sources, counts as droppedMinTokens', () => {
  const r = buildModelMixEntropy(
    [
      ql('2026-04-20T01:00:00Z', 'big', 'ma', 1000),
      ql('2026-04-20T02:00:00Z', 'small', 'mb', 50),
    ],
    { generatedAt: GEN, minTokens: 500 },
  );
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedMinTokens, 1);
});

// ---- window filtering ------------------------------------------------------

test('model-mix-entropy: respects since/until window', () => {
  const r = buildModelMixEntropy(
    [
      ql('2026-04-19T00:00:00Z', 'codex', 'ma', 100), // before
      ql('2026-04-20T05:00:00Z', 'codex', 'mb', 200), // in
      ql('2026-04-21T00:00:00Z', 'codex', 'mc', 400), // boundary excluded
    ],
    {
      generatedAt: GEN,
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
    },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalTokens, 200);
  assert.equal(r.sources[0]!.distinctModels, 1);
  assert.equal(r.sources[0]!.topModel, 'mb');
});
