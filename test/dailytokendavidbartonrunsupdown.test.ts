import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenDavidBartonRunsUpDown,
  buildDailyTokenDavidBartonRunsUpDown,
  countRunsUpDownDavidBarton,
  standardNormalUpperTailDavidBarton,
  aggregateDavidBartonRunsUpDown,
} from '../src/dailytokendavidbartonrunsupdown.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return { hour_start, source, total_tokens } as unknown as QueueLine;
}

function dayIso(i: number): string {
  return (
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z'
  );
}

// ---------- countRunsUpDownDavidBarton ----------

test('countRunsUpDownDavidBarton: strictly increasing => 1 run', () => {
  const r = countRunsUpDownDavidBarton([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(r.dbR, 1);
  assert.equal(r.dbDiffs, 11);
  assert.equal(r.dbZeros, 0);
});

test('countRunsUpDownDavidBarton: strictly decreasing => 1 run', () => {
  const r = countRunsUpDownDavidBarton([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(r.dbR, 1);
});

test('countRunsUpDownDavidBarton: perfect alternation => n-1 runs', () => {
  const v = [1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5];
  const r = countRunsUpDownDavidBarton(v);
  assert.equal(r.dbR, v.length - 1);
});

test('countRunsUpDownDavidBarton: empty / singleton => 0 runs', () => {
  assert.equal(countRunsUpDownDavidBarton([]).dbR, 0);
  assert.equal(countRunsUpDownDavidBarton([5]).dbR, 0);
});

test('countRunsUpDownDavidBarton: zeros absorbed by carry-forward', () => {
  // diffs: +1,+1,0,+1,-1 -> after carry: +,+,+,+,- -> 2 runs
  const r = countRunsUpDownDavidBarton([1, 2, 3, 3, 4, 3]);
  assert.equal(r.dbR, 2);
  assert.equal(r.dbZeros, 1);
});

test('countRunsUpDownDavidBarton: leading zeros dropped', () => {
  // diffs: 0,0,+1,+1 -> carry has nothing to carry -> 1 run
  const r = countRunsUpDownDavidBarton([5, 5, 5, 6, 7]);
  assert.equal(r.dbR, 1);
  assert.equal(r.dbZeros, 2);
});

test('countRunsUpDownDavidBarton: all-equal => 0 runs all zeros', () => {
  const r = countRunsUpDownDavidBarton([4, 4, 4, 4, 4]);
  assert.equal(r.dbR, 0);
  assert.equal(r.dbZeros, 4);
});

// ---------- standardNormalUpperTailDavidBarton ----------

test('standardNormalUpperTailDavidBarton: Q(0) ~ 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailDavidBarton(0) - 0.5) < 1e-7);
});

test('standardNormalUpperTailDavidBarton: Q(1.96) ~ 0.025', () => {
  assert.ok(Math.abs(standardNormalUpperTailDavidBarton(1.96) - 0.025) < 1e-4);
});

test('standardNormalUpperTailDavidBarton: Q(-z) = 1 - Q(z)', () => {
  for (const z of [0.1, 0.5, 1.0, 2.5, 3.5]) {
    const q1 = standardNormalUpperTailDavidBarton(z);
    const q2 = standardNormalUpperTailDavidBarton(-z);
    assert.ok(Math.abs(q2 - (1 - q1)) < 1e-7);
  }
});

test('standardNormalUpperTailDavidBarton: throws on non-finite', () => {
  assert.throws(() => standardNormalUpperTailDavidBarton(Number.NaN));
});

// ---------- dailyTokenDavidBartonRunsUpDown ----------

test('dailyTokenDavidBartonRunsUpDown: requires n >= 12', () => {
  assert.throws(() => dailyTokenDavidBartonRunsUpDown([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
});

test('dailyTokenDavidBartonRunsUpDown: rejects non-finite values', () => {
  const v = Array.from({ length: 14 }, (_, i) => i);
  v[3] = Number.POSITIVE_INFINITY;
  assert.throws(() => dailyTokenDavidBartonRunsUpDown(v));
});

test('dailyTokenDavidBartonRunsUpDown: throws on zero variance', () => {
  assert.throws(() =>
    dailyTokenDavidBartonRunsUpDown(Array.from({ length: 14 }, () => 7)),
  );
});

test('dailyTokenDavidBartonRunsUpDown: monotone-up gives strongly negative dbZ (1 run << expected)', () => {
  const v = Array.from({ length: 30 }, (_, i) => i + 1);
  const r = dailyTokenDavidBartonRunsUpDown(v);
  assert.equal(r.dbR, 1);
  assert.ok(r.dbZ < -3);
  assert.ok(r.dbPValue < 0.01);
});

test('dailyTokenDavidBartonRunsUpDown: monotone-down gives strongly negative dbZ', () => {
  const v = Array.from({ length: 30 }, (_, i) => 100 - i);
  const r = dailyTokenDavidBartonRunsUpDown(v);
  assert.equal(r.dbR, 1);
  assert.ok(r.dbZ < -3);
});

test('dailyTokenDavidBartonRunsUpDown: alternating gives strongly positive dbZ (max runs)', () => {
  const v: number[] = [];
  for (let i = 0; i < 30; i += 1) v.push(i % 2 === 0 ? 1 : 5);
  const r = dailyTokenDavidBartonRunsUpDown(v);
  assert.equal(r.dbR, 29);
  assert.ok(r.dbZ > 3);
});

test('dailyTokenDavidBartonRunsUpDown: shift-invariance dbZ(x+c) = dbZ(x)', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9];
  const r1 = dailyTokenDavidBartonRunsUpDown(v);
  const r2 = dailyTokenDavidBartonRunsUpDown(v.map((x) => x + 100.5));
  assert.equal(r1.dbR, r2.dbR);
  assert.ok(Math.abs(r1.dbZ - r2.dbZ) < 1e-12);
});

test('dailyTokenDavidBartonRunsUpDown: positive-scale-invariance dbZ(a*x) = dbZ(x)', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9];
  const r1 = dailyTokenDavidBartonRunsUpDown(v);
  const r2 = dailyTokenDavidBartonRunsUpDown(v.map((x) => 7.25 * x));
  assert.equal(r1.dbR, r2.dbR);
  assert.ok(Math.abs(r1.dbZ - r2.dbZ) < 1e-12);
});

test('dailyTokenDavidBartonRunsUpDown: negation also preserves dbR (uniform sign flip)', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9];
  const r1 = dailyTokenDavidBartonRunsUpDown(v);
  const r2 = dailyTokenDavidBartonRunsUpDown(v.map((x) => -x));
  assert.equal(r1.dbR, r2.dbR);
});

test('dailyTokenDavidBartonRunsUpDown: dbExpR matches (2n-1)/3', () => {
  const v = Array.from({ length: 20 }, (_, i) => Math.sin(i) + i * 0.01);
  const r = dailyTokenDavidBartonRunsUpDown(v);
  assert.ok(Math.abs(r.dbExpR - (2 * 20 - 1) / 3) < 1e-12);
});

test('dailyTokenDavidBartonRunsUpDown: dbVar matches (16n-29)/90', () => {
  const v = Array.from({ length: 25 }, (_, i) => Math.sin(i * 1.7) + i * 0.001);
  const r = dailyTokenDavidBartonRunsUpDown(v);
  assert.ok(Math.abs(r.dbVar - (16 * 25 - 29) / 90) < 1e-12);
});

test('dailyTokenDavidBartonRunsUpDown: deterministic on same input', () => {
  const v = [1, 4, 2, 8, 5, 7, 3, 9, 6, 10, 11, 4, 5, 7];
  const r1 = dailyTokenDavidBartonRunsUpDown(v);
  const r2 = dailyTokenDavidBartonRunsUpDown(v);
  assert.deepEqual(r1, r2);
});

// ---------- aggregateDavidBartonRunsUpDown ----------

test('aggregateDavidBartonRunsUpDown: empty rows yields zero stoufferZ', () => {
  const a = aggregateDavidBartonRunsUpDown([]);
  assert.equal(a.stoufferZ, 0);
  assert.equal(a.rowsUsed, 0);
});

test('aggregateDavidBartonRunsUpDown: skips malformed rows', () => {
  const a = aggregateDavidBartonRunsUpDown([
    { dbZ: Number.NaN, dbPValue: 0.5, dbVar: 1, nTenureDays: 14 },
    { dbZ: 1.5, dbPValue: 0.13, dbVar: 1.2, nTenureDays: 14 },
    { dbZ: -0.5, dbPValue: 0.62, dbVar: 1.1, nTenureDays: 20 },
  ]);
  assert.equal(a.rowsUsed, 2);
  assert.equal(a.rowsSkipped, 1);
  assert.ok(Math.abs(a.stoufferZ - (1.5 + -0.5) / Math.sqrt(2)) < 1e-12);
});

test('aggregateDavidBartonRunsUpDown: tenure-weighted mean weights long sources more', () => {
  const a = aggregateDavidBartonRunsUpDown([
    { dbZ: 2.0, dbPValue: 0.05, dbVar: 1, nTenureDays: 100 },
    { dbZ: -2.0, dbPValue: 0.05, dbVar: 1, nTenureDays: 1 },
  ]);
  assert.ok(a.tenureWeightedMeanDbZ > 1.5); // dominated by the long-tenure +2
});

// ---------- buildDailyTokenDavidBartonRunsUpDown ----------

test('buildDailyTokenDavidBartonRunsUpDown: basic per-source aggregation', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1000 + (i % 3) * 500));
  }
  const r = buildDailyTokenDavidBartonRunsUpDown(queue, {
    minTokens: 0,
    minTenureDays: 12,
    generatedAt: '2026-01-25T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'srcA');
  assert.ok(Number.isFinite(r.sources[0]!.dbZ));
});

test('buildDailyTokenDavidBartonRunsUpDown: filters by min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'small', 10));
  }
  const r = buildDailyTokenDavidBartonRunsUpDown(queue, {
    minTokens: 1000,
    generatedAt: '2026-01-25T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenDavidBartonRunsUpDown: filters by tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'short', 5000));
  }
  const r = buildDailyTokenDavidBartonRunsUpDown(queue, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: '2026-01-25T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenDavidBartonRunsUpDown: zero-variance source filtered', () => {
  const queue: QueueLine[] = [];
  // Build a source that gap-fills to constant 0 (no variation across days)
  // Since we always have positive tokens on the days we record, fill with same value across all 14 days
  for (let i = 0; i < 14; i += 1) queue.push(ql(dayIso(i), 'flat', 100));
  const r = buildDailyTokenDavidBartonRunsUpDown(queue, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: '2026-01-25T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenDavidBartonRunsUpDown: invalid sort throws', () => {
  assert.throws(() =>
    buildDailyTokenDavidBartonRunsUpDown([], {
      sort: 'badSort' as unknown as 'dbZ',
    }),
  );
});

test('buildDailyTokenDavidBartonRunsUpDown: sort dbZ orders ascending', () => {
  const queue: QueueLine[] = [];
  // monotone source -> dbZ very negative
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'mono', 1000 + i * 50));
  // alternating source -> dbZ positive
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'alt', i % 2 === 0 ? 1000 : 5000));
  }
  const r = buildDailyTokenDavidBartonRunsUpDown(queue, {
    minTokens: 0,
    minTenureDays: 12,
    sort: 'dbZ',
    generatedAt: '2026-01-25T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'mono');
  assert.equal(r.sources[1]!.source, 'alt');
});

test('buildDailyTokenDavidBartonRunsUpDown: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'x', 1000),
    ...Array.from({ length: 14 }, (_, i) => ql(dayIso(i), 'x', 1000 + i)),
  ];
  const r = buildDailyTokenDavidBartonRunsUpDown(queue, {
    minTokens: 0,
    minTenureDays: 12,
    generatedAt: '2026-01-25T00:00:00.000Z',
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('buildDailyTokenDavidBartonRunsUpDown: --top caps results', () => {
  const queue: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    for (let i = 0; i < 14; i += 1) queue.push(ql(dayIso(i), s, 1000 + i * 17));
  }
  const r = buildDailyTokenDavidBartonRunsUpDown(queue, {
    minTokens: 0,
    minTenureDays: 12,
    top: 2,
    sort: 'tokens',
    generatedAt: '2026-01-25T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenDavidBartonRunsUpDown: source filter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) queue.push(ql(dayIso(i), 'a', 1000 + i));
  for (let i = 0; i < 14; i += 1) queue.push(ql(dayIso(i), 'b', 1000 + i * 2));
  const r = buildDailyTokenDavidBartonRunsUpDown(queue, {
    minTokens: 0,
    minTenureDays: 12,
    source: 'a',
    generatedAt: '2026-01-25T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 14);
});
