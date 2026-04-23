import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  computeCost,
  DEFAULT_RATES,
  mergeRates,
  readRatesFile,
} from '../src/cost.ts';
import type { QueueLine } from '../src/types.ts';

function q(o: Partial<QueueLine>): QueueLine {
  return {
    source: 'claude-code',
    model: 'claude-opus-4.7',
    hour_start: '2026-04-20T12:00:00.000Z',
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0,
    ...o,
  };
}

test('DEFAULT_RATES contains all five required canonical models', () => {
  for (const m of [
    'claude-opus-4.7',
    'claude-sonnet-4.6',
    'gpt-5.4',
    'gpt-5.2',
    'gpt-5-nano',
  ]) {
    assert.ok(DEFAULT_RATES[m], `missing default rate for ${m}`);
    const r = DEFAULT_RATES[m]!;
    assert.ok(r.input >= 0 && r.output >= 0);
    // Cached input must be cheaper than (or equal to) full input.
    assert.ok(r.cachedInput <= r.input);
  }
});

test('computeCost: prices a single opus row using defaults', () => {
  const queue: QueueLine[] = [
    q({
      model: 'claude-opus-4.7',
      input_tokens: 1_000_000,
      output_tokens: 100_000,
      cached_input_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 1_100_000,
    }),
  ];
  const r = computeCost(queue, null, DEFAULT_RATES);
  // 1M input @ $15 + 100k output @ $75/M = 15 + 7.5 = 22.5
  assert.equal(r.totalCost.toFixed(4), '22.5000');
  assert.equal(r.cacheSavings, 0);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.model, 'claude-opus-4.7');
});

test('computeCost: cache savings counted vs no-cache baseline', () => {
  const queue: QueueLine[] = [
    q({
      input_tokens: 0,
      cached_input_tokens: 1_000_000, // 1M cached
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 1_000_000,
    }),
  ];
  const r = computeCost(queue, null, DEFAULT_RATES);
  const opus = DEFAULT_RATES['claude-opus-4.7']!;
  const expectedActual = opus.cachedInput; // 1M tokens × $1.50/M = $1.50
  const expectedNoCache = opus.input; // would have been $15
  assert.equal(r.totalCost.toFixed(4), expectedActual.toFixed(4));
  assert.equal(r.totalCostNoCache.toFixed(4), expectedNoCache.toFixed(4));
  assert.equal(
    r.cacheSavings.toFixed(4),
    (expectedNoCache - expectedActual).toFixed(4),
  );
});

test('computeCost: unknown models segregated, contribute zero cost', () => {
  const queue: QueueLine[] = [
    q({ model: 'claude-opus-4.7', input_tokens: 1_000_000, total_tokens: 1_000_000 }),
    q({ model: 'mystery-model-9000', output_tokens: 5000, total_tokens: 5000 }),
  ];
  const r = computeCost(queue, null, DEFAULT_RATES);
  assert.equal(r.rows.length, 1);
  assert.equal(r.unknownModels.length, 1);
  assert.equal(r.unknownModels[0]!.model, 'mystery-model-9000');
  // Unknown row contributes nothing.
  assert.equal(r.totalCost.toFixed(4), '15.0000');
});

test('computeCost: respects since window', () => {
  const queue: QueueLine[] = [
    q({ hour_start: '2026-04-19T12:00:00.000Z', input_tokens: 1_000_000, total_tokens: 1_000_000 }),
    q({ hour_start: '2026-04-21T12:00:00.000Z', input_tokens: 2_000_000, total_tokens: 2_000_000 }),
  ];
  const r = computeCost(queue, '2026-04-20T00:00:00.000Z', DEFAULT_RATES);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.inputTokens, 2_000_000);
});

test('readRatesFile + mergeRates: user table overrides defaults per-model', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pew-rates-'));
  const path = join(dir, 'rates.json');
  await writeFile(
    path,
    JSON.stringify({
      'claude-opus-4.7': { input: 1, cachedInput: 0.1, output: 2, reasoning: 2 },
      'my-model': { input: 0.5, cached_input: 0.05, output: 1.5 },
    }),
    'utf8',
  );
  try {
    const user = await readRatesFile(path);
    assert.ok(user);
    const merged = mergeRates(DEFAULT_RATES, user);
    assert.equal(merged['claude-opus-4.7']!.input, 1);
    // Other defaults still present.
    assert.ok(merged['gpt-5-nano']);
    // Custom alias `cached_input` accepted.
    assert.equal(merged['my-model']!.cachedInput, 0.05);
    // reasoning falls back to output when omitted.
    assert.equal(merged['my-model']!.reasoning, 1.5);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readRatesFile: returns null when file missing (caller falls back to defaults)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pew-rates-'));
  try {
    const r = await readRatesFile(join(dir, 'nope.json'));
    assert.equal(r, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readRatesFile: throws on invalid shape', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pew-rates-'));
  const path = join(dir, 'bad.json');
  await writeFile(path, JSON.stringify(['not', 'an', 'object']), 'utf8');
  try {
    await assert.rejects(() => readRatesFile(path));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('computeCost: blended rate per million is sane', () => {
  const queue: QueueLine[] = [
    q({
      model: 'gpt-5-nano',
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      total_tokens: 2_000_000,
    }),
  ];
  const r = computeCost(queue, null, DEFAULT_RATES);
  const row = r.rows[0]!;
  // 1M @ $0.20 + 1M @ $0.80 = $1.00 over 2M tokens = $0.50/M blended.
  assert.equal(row.blendedRatePerMillion.toFixed(2), '0.50');
});
