import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenHillTailIndex,
  hillTailIndexOfVector,
} from '../src/dailytokenhilltailindex.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-01T12:00:00.000Z';

// ---- hillTailIndexOfVector primitive -----------------------------------

test('hillTailIndexOfVector: rejects topFrac out of (0,1)', () => {
  assert.throws(() => hillTailIndexOfVector([1, 2, 3], 0));
  assert.throws(() => hillTailIndexOfVector([1, 2, 3], 1));
  assert.throws(() => hillTailIndexOfVector([1, 2, 3], -0.1));
  assert.throws(() => hillTailIndexOfVector([1, 2, 3], 1.5));
});

test('hillTailIndexOfVector: rejects non-positive values', () => {
  assert.throws(() => hillTailIndexOfVector([1, 0, 3], 0.2));
  assert.throws(() => hillTailIndexOfVector([1, -2, 3], 0.2));
  assert.throws(() => hillTailIndexOfVector([1, NaN, 3], 0.2));
});

test('hillTailIndexOfVector: empty / singleton -> degenerate', () => {
  const r0 = hillTailIndexOfVector([], 0.2);
  assert.equal(r0.degenerate, true);
  assert.equal(r0.k, 0);
  const r1 = hillTailIndexOfVector([42], 0.2);
  assert.equal(r1.degenerate, true);
});

test('hillTailIndexOfVector: all-equal -> gamma=0 -> alpha=Infinity, degenerate', () => {
  const r = hillTailIndexOfVector([7, 7, 7, 7, 7, 7, 7, 7, 7, 7], 0.2);
  // k = floor(10 * 0.2) = 2; threshold = 7; sum log(7) - log(7) = 0 -> gamma 0.
  assert.equal(r.k, 2);
  assert.equal(r.threshold, 7);
  assert.equal(r.gamma, 0);
  assert.equal(r.alpha, Infinity);
  assert.equal(r.degenerate, true);
});

test('hillTailIndexOfVector: closed-form Pareto example', () => {
  // Take values [1, 2, 4, 8, 16, 32, 64, 128, 256, 512] (geometric, ratio 2).
  // Sort desc: [512, 256, 128, 64, 32, 16, 8, 4, 2, 1]
  // n=10, k = floor(10 * 0.2) = 2
  // threshold = sorted[2] = 128
  // sum_{i=0..1} log(sorted[i]) - log(128) = (log 512 - log 128) + (log 256 - log 128)
  //                                          = log(512/128) + log(256/128) = log 4 + log 2 = 3*log 2
  // gamma = 3*log(2) / 2; alpha = 2 / (3*log(2)) ~= 0.96179...
  const values = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
  const r = hillTailIndexOfVector(values, 0.2);
  assert.equal(r.k, 2);
  assert.equal(r.threshold, 128);
  const gammaExpected = (3 * Math.log(2)) / 2;
  assert.ok(Math.abs(r.gamma - gammaExpected) < 1e-12);
  const alphaExpected = 1 / gammaExpected;
  assert.ok(Math.abs(r.alpha - alphaExpected) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('hillTailIndexOfVector: scale invariance -- multiply by c > 0', () => {
  const values = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
  const r1 = hillTailIndexOfVector(values, 0.2);
  const scaled = values.map((v) => v * 137.5);
  const r2 = hillTailIndexOfVector(scaled, 0.2);
  assert.ok(Math.abs(r1.alpha - r2.alpha) < 1e-12);
  assert.ok(Math.abs(r1.gamma - r2.gamma) < 1e-12);
  // threshold scales though.
  assert.ok(Math.abs(r2.threshold - 128 * 137.5) < 1e-9);
});

test('hillTailIndexOfVector: bottom-(n-k-1) values are irrelevant', () => {
  // Replace the bottom 7 values with arbitrary positive numbers; alpha unchanged.
  const top3 = [128, 256, 512];
  const a = hillTailIndexOfVector([1, 2, 4, 8, 16, 32, 64, ...top3], 0.2);
  const b = hillTailIndexOfVector(
    [0.001, 99, 0.5, 100, 0.1, 50, 1, ...top3],
    0.2,
  );
  // Note: k = 2 in both, threshold = 128 (the (k+1)-th largest = 3rd largest).
  // Top-2 are [512, 256]; gamma is identical.
  assert.equal(a.threshold, 128);
  assert.equal(b.threshold, 128);
  assert.ok(Math.abs(a.alpha - b.alpha) < 1e-12);
});

// ---- buildDailyTokenHillTailIndex builder ------------------------------

test('build: empty queue -> totalSources 0', () => {
  const r = buildDailyTokenHillTailIndex([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('build: drops sources below min-days', () => {
  const queue: QueueLine[] = [];
  // Only 5 days for source A
  for (let i = 1; i <= 5; i += 1) {
    queue.push(ql(`2026-04-${String(i).padStart(2, '0')}T00:00:00.000Z`, 'A', 1000 * i));
  }
  const r = buildDailyTokenHillTailIndex(queue, {
    generatedAt: GEN,
    minDays: 10,
  });
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.sources.length, 0);
});

test('build: drops sources below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 12; i += 1) {
    queue.push(ql(`2026-04-${String(i).padStart(2, '0')}T00:00:00.000Z`, 'A', 10));
  }
  const r = buildDailyTokenHillTailIndex(queue, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('build: end-to-end on geometric source matches primitive', () => {
  const queue: QueueLine[] = [];
  const vals = [1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, 512000];
  for (let i = 0; i < vals.length; i += 1) {
    const day = String(i + 1).padStart(2, '0');
    queue.push(ql(`2026-04-${day}T00:00:00.000Z`, 'GEO', vals[i]!));
  }
  const r = buildDailyTokenHillTailIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'GEO');
  assert.equal(row.nDays, 10);
  assert.equal(row.k, 2);
  assert.equal(row.threshold, 128000);
  // Same geometric ratio -> same gamma / alpha (scale invariance).
  const gammaExpected = (3 * Math.log(2)) / 2;
  assert.ok(Math.abs(row.gamma - gammaExpected) < 1e-12);
  assert.ok(Math.abs(row.alpha - 1 / gammaExpected) < 1e-12);
  // gammaStdErr = gamma / sqrt(k) = gammaExpected / sqrt(2)
  assert.ok(Math.abs(row.gammaStdErr - gammaExpected / Math.sqrt(2)) < 1e-12);
  assert.equal(row.degenerate, false);
});

test('build: max-alpha filter hides light-tailed sources', () => {
  const queue: QueueLine[] = [];
  // GEO source: heavy tail, alpha ~ 0.96
  const geoVals = [1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, 512000];
  for (let i = 0; i < geoVals.length; i += 1) {
    queue.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`, 'GEO', geoVals[i]!));
  }
  // FLAT source: alpha = Infinity (degenerate) - will be retained.
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T01:00:00.000Z`, 'FLAT', 5000));
  }
  // LIGHT source: very tight values -> very large alpha (light tail).
  // top-2 = [10100, 10090]; threshold = 10080; gamma tiny -> alpha huge.
  const lightVals = [10000, 10010, 10020, 10030, 10040, 10050, 10060, 10080, 10090, 10100];
  for (let i = 0; i < lightVals.length; i += 1) {
    queue.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T02:00:00.000Z`, 'LIGHT', lightVals[i]!));
  }
  const r = buildDailyTokenHillTailIndex(queue, {
    generatedAt: GEN,
    maxAlpha: 1.5, // keep only heavy-tailed (alpha <= 1.5)
  });
  // GEO (alpha~0.96) kept; FLAT (degenerate) kept; LIGHT might be dropped.
  const sources = r.sources.map((s) => s.source).sort();
  assert.ok(sources.includes('GEO'));
  assert.ok(sources.includes('FLAT'));
  assert.ok(!sources.includes('LIGHT'));
  assert.equal(r.droppedAboveMaxAlpha, 1);
});

test('build: rejects bad knobs', () => {
  assert.throws(() => buildDailyTokenHillTailIndex([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenHillTailIndex([], { minDays: 3 }));
  assert.throws(() => buildDailyTokenHillTailIndex([], { topFrac: 0 }));
  assert.throws(() => buildDailyTokenHillTailIndex([], { topFrac: 1 }));
  assert.throws(() => buildDailyTokenHillTailIndex([], { top: -2 }));
  assert.throws(() => buildDailyTokenHillTailIndex([], { sort: 'bogus' as never }));
  assert.throws(() => buildDailyTokenHillTailIndex([], { since: 'not-a-date' }));
  assert.throws(() => buildDailyTokenHillTailIndex([], { maxAlpha: 0 }));
});

test('build: source filter restricts to a single source', () => {
  const queue: QueueLine[] = [];
  const vals = [1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, 512000];
  for (let i = 0; i < vals.length; i += 1) {
    const day = String(i + 1).padStart(2, '0');
    queue.push(ql(`2026-04-${day}T00:00:00.000Z`, 'KEEP', vals[i]!));
    queue.push(ql(`2026-04-${day}T00:00:00.000Z`, 'DROP', vals[i]!));
  }
  const r = buildDailyTokenHillTailIndex(queue, {
    generatedAt: GEN,
    source: 'KEEP',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'KEEP');
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: respects --since/--until window', () => {
  const queue: QueueLine[] = [];
  // 12 days; only 10 fall inside window
  for (let i = 1; i <= 12; i += 1) {
    queue.push(ql(`2026-04-${String(i).padStart(2, '0')}T00:00:00.000Z`, 'W', 1000 * i));
  }
  const r = buildDailyTokenHillTailIndex(queue, {
    generatedAt: GEN,
    since: '2026-04-02T00:00:00.000Z',
    until: '2026-04-12T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nDays, 10);
});

// ---- refinement: end-to-end scale invariance + extra edge cases --------

test('build: end-to-end scale invariance -- multiplying every queue row by c > 0 leaves alpha unchanged', () => {
  const baseVals = [1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, 512000];
  const queueA: QueueLine[] = [];
  const queueB: QueueLine[] = [];
  const C = 137.5;
  for (let i = 0; i < baseVals.length; i += 1) {
    const day = String(i + 1).padStart(2, '0');
    queueA.push(ql(`2026-04-${day}T00:00:00.000Z`, 'X', baseVals[i]!));
    queueB.push(ql(`2026-04-${day}T00:00:00.000Z`, 'X', baseVals[i]! * C));
  }
  const a = buildDailyTokenHillTailIndex(queueA, { generatedAt: GEN });
  const b = buildDailyTokenHillTailIndex(queueB, { generatedAt: GEN });
  assert.equal(a.sources.length, 1);
  assert.equal(b.sources.length, 1);
  // alpha and gamma identical to machine precision.
  assert.ok(Math.abs(a.sources[0]!.alpha - b.sources[0]!.alpha) < 1e-12);
  assert.ok(Math.abs(a.sources[0]!.gamma - b.sources[0]!.gamma) < 1e-12);
  // Threshold scales linearly.
  assert.ok(Math.abs(b.sources[0]!.threshold - a.sources[0]!.threshold * C) < 1e-6);
});

test('build: min-tokens=0 admits even tiny-mass sources (boundary)', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 10; i += 1) {
    queue.push(ql(`2026-04-${String(i).padStart(2, '0')}T00:00:00.000Z`, 'TINY', i));
  }
  const r = buildDailyTokenHillTailIndex(queue, { generatedAt: GEN, minTokens: 0 });
  assert.equal(r.droppedSparseSources, 0);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalTokens, 55);
});

test('build: degenerate (all-equal day vector) -> alpha=Infinity, sorted to front under --sort alpha', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 12; i += 1) {
    queue.push(ql(`2026-04-${String(i).padStart(2, '0')}T00:00:00.000Z`, 'FLAT', 5000));
  }
  const r = buildDailyTokenHillTailIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.degenerate, true);
  assert.equal(r.sources[0]!.alpha, Infinity);
  assert.equal(r.sources[0]!.gammaStdErr, 0);
});

test('build: hourly buckets correctly collapse into per-day totals', () => {
  const queue: QueueLine[] = [];
  // Same day, two hourly buckets each
  for (let i = 1; i <= 10; i += 1) {
    const day = String(i).padStart(2, '0');
    queue.push(ql(`2026-04-${day}T00:00:00.000Z`, 'COLL', 500 * i));
    queue.push(ql(`2026-04-${day}T01:00:00.000Z`, 'COLL', 500 * i));
  }
  const r = buildDailyTokenHillTailIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nDays, 10);
  // largest day = day 10 = 1000 * 10 = 10000; threshold (3rd largest) = 1000 * 8 = 8000
  assert.equal(r.sources[0]!.threshold, 8000);
});
