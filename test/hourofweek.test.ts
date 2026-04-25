import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildHourOfWeek } from '../src/hourofweek.js';
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
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: totalTokens,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation ----------------------------------------------------

test('hour-of-week: rejects bad top', () => {
  assert.throws(() => buildHourOfWeek([], { top: 0 }));
  assert.throws(() => buildHourOfWeek([], { top: -1 }));
  assert.throws(() => buildHourOfWeek([], { top: 1.5 }));
});

test('hour-of-week: rejects bad topK', () => {
  assert.throws(() => buildHourOfWeek([], { topK: 0 }));
  assert.throws(() => buildHourOfWeek([], { topK: 169 }));
  assert.throws(() => buildHourOfWeek([], { topK: 1.5 }));
});

test('hour-of-week: rejects bad since/until', () => {
  assert.throws(() => buildHourOfWeek([], { since: 'no' }));
  assert.throws(() => buildHourOfWeek([], { until: 'nope' }));
});

// ---- empty / shape --------------------------------------------------------

test('hour-of-week: empty input yields zero population', () => {
  const r = buildHourOfWeek([], { generatedAt: GEN });
  assert.equal(r.totalBuckets, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.populatedCells, 0);
  assert.equal(r.deadCells, 168);
  assert.equal(r.entropyBits, 0);
  assert.equal(r.normalisedEntropy, 0);
  assert.equal(r.gini, 0);
  assert.equal(r.topKShare, 0);
  assert.deepEqual(r.topCells, []);
  assert.equal(r.generatedAt, GEN);
});

// ---- weekday/hour mapping --------------------------------------------------

test('hour-of-week: ISO weekday mapping is Mon=1..Sun=7 in UTC', () => {
  // 2026-04-20 is a Monday UTC, hour 0
  // 2026-04-26 is a Sunday UTC, hour 23
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt-5', 100),
    ql('2026-04-26T23:00:00.000Z', 'codex', 'gpt-5', 200),
  ];
  const r = buildHourOfWeek(rows, { generatedAt: GEN });
  assert.equal(r.totalBuckets, 2);
  assert.equal(r.totalTokens, 300);
  assert.equal(r.populatedCells, 2);
  assert.equal(r.deadCells, 166);
  // Top by tokens: Sun 23:00 (200), then Mon 00:00 (100)
  assert.equal(r.topCells[0]!.weekday, 7);
  assert.equal(r.topCells[0]!.hour, 23);
  assert.equal(r.topCells[0]!.tokens, 200);
  assert.equal(r.topCells[1]!.weekday, 1);
  assert.equal(r.topCells[1]!.hour, 0);
});

// ---- entropy: uniform = max ------------------------------------------------

test('hour-of-week: uniform population yields max entropy and gini=0', () => {
  // One bucket per cell, equal tokens -> entropy = log2(168)
  const rows: QueueLine[] = [];
  // Pick a Monday 00:00 UTC start and step 1 hour for 168 hours.
  const startMs = Date.parse('2026-04-20T00:00:00.000Z');
  for (let i = 0; i < 168; i++) {
    const iso = new Date(startMs + i * 3600_000).toISOString();
    rows.push(ql(iso, 'codex', 'gpt-5', 1000));
  }
  const r = buildHourOfWeek(rows, { generatedAt: GEN });
  assert.equal(r.populatedCells, 168);
  assert.equal(r.deadCells, 0);
  // entropy should equal log2(168) within float tolerance
  assert.ok(
    Math.abs(r.entropyBits - Math.log2(168)) < 1e-9,
    `entropyBits=${r.entropyBits}`,
  );
  assert.ok(Math.abs(r.normalisedEntropy - 1) < 1e-9);
  assert.ok(r.gini < 1e-9, `gini=${r.gini}`);
});

// ---- entropy: single cell = 0, gini ~ 1 -----------------------------------

test('hour-of-week: single-cell concentration yields entropy=0 and gini~1', () => {
  const rows = [
    ql('2026-04-20T09:00:00.000Z', 'codex', 'gpt-5', 1000),
    ql('2026-04-20T09:00:00.000Z', 'codex', 'gpt-5', 500),
  ];
  const r = buildHourOfWeek(rows, { generatedAt: GEN });
  assert.equal(r.populatedCells, 1);
  assert.equal(r.deadCells, 167);
  assert.ok(Math.abs(r.entropyBits) < 1e-9);
  assert.ok(Math.abs(r.normalisedEntropy) < 1e-9);
  // gini for 167 zeros + 1 mass: G = (n - 1) / n = 167/168
  assert.ok(
    Math.abs(r.gini - 167 / 168) < 1e-9,
    `gini=${r.gini} expected ~${167 / 168}`,
  );
  assert.equal(r.topKShare, 1);
});

// ---- topK share and top cap ----------------------------------------------

test('hour-of-week: topKShare reflects requested K independent of top cap', () => {
  // 3 cells: Mon 00 = 700, Tue 00 = 200, Wed 00 = 100
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt-5', 700),
    ql('2026-04-21T00:00:00.000Z', 'codex', 'gpt-5', 200),
    ql('2026-04-22T00:00:00.000Z', 'codex', 'gpt-5', 100),
  ];
  const r = buildHourOfWeek(rows, { generatedAt: GEN, top: 2, topK: 2 });
  assert.equal(r.topCells.length, 2);
  assert.ok(Math.abs(r.topKShare - 0.9) < 1e-9);
  // top cap doesn't change populated count
  assert.equal(r.populatedCells, 3);
});

// ---- source / model filter ----------------------------------------------

test('hour-of-week: source filter excludes non-matching rows', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'opencode', 'gpt-5', 999),
  ];
  const r = buildHourOfWeek(rows, { generatedAt: GEN, source: 'codex' });
  assert.equal(r.totalTokens, 100);
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.source, 'codex');
});

// ---- bad rows --------------------------------------------------------------

test('hour-of-week: bad hour_start and zero tokens are dropped and counted', () => {
  const rows = [
    ql('not-a-date', 'codex', 'gpt-5', 100),
    ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt-5', 0),
    ql('2026-04-20T01:00:00.000Z', 'codex', 'gpt-5', 50),
  ];
  const r = buildHourOfWeek(rows, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.totalTokens, 50);
});
