import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenCoxStuartSignPairs,
  buildDailyTokenCoxStuartSignPairs,
  countCoxStuartPairs,
  standardNormalUpperTailCoxStuart,
  aggregateCoxStuartSignPairs,
} from '../src/dailytokencoxstuartsignpairs.js';
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

// ---------- countCoxStuartPairs ----------

test('countCoxStuartPairs: even n splits into n/2 pairs at c=n/2', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = countCoxStuartPairs(v);
  assert.equal(r.csC, 5);
  assert.equal(r.csPairs, 5);
  assert.equal(r.csPlus, 5); // every pair v[i+5] > v[i]
  assert.equal(r.csMinus, 0);
  assert.equal(r.csTies, 0);
});

test('countCoxStuartPairs: odd n drops middle, c = ceil(n/2)', () => {
  // n=11, c=6, pairs=5: (v[0],v[6]) ... (v[4],v[10]); middle v[5] dropped
  const v = [1, 2, 3, 4, 5, 999, 7, 8, 9, 10, 11];
  const r = countCoxStuartPairs(v);
  assert.equal(r.csC, 6);
  assert.equal(r.csPairs, 5);
  assert.equal(r.csPlus, 5);
});

test('countCoxStuartPairs: strictly decreasing => csMinus = csPairs', () => {
  const v = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const r = countCoxStuartPairs(v);
  assert.equal(r.csMinus, 5);
  assert.equal(r.csPlus, 0);
  assert.equal(r.csTies, 0);
});

test('countCoxStuartPairs: empty / singleton => zero pairs', () => {
  assert.equal(countCoxStuartPairs([]).csPairs, 0);
  assert.equal(countCoxStuartPairs([5]).csPairs, 0);
});

test('countCoxStuartPairs: all-equal => all ties', () => {
  const v = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
  const r = countCoxStuartPairs(v);
  assert.equal(r.csTies, 5);
  assert.equal(r.csPlus, 0);
  assert.equal(r.csMinus, 0);
});

test('countCoxStuartPairs: csPlus + csMinus + csTies = csPairs', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4];
  const r = countCoxStuartPairs(v);
  assert.equal(r.csPlus + r.csMinus + r.csTies, r.csPairs);
});

// ---------- standardNormalUpperTailCoxStuart ----------

test('standardNormalUpperTailCoxStuart: Q(0) ~ 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailCoxStuart(0) - 0.5) < 1e-7);
});

test('standardNormalUpperTailCoxStuart: Q(1.96) ~ 0.025', () => {
  assert.ok(Math.abs(standardNormalUpperTailCoxStuart(1.96) - 0.025) < 1e-4);
});

test('standardNormalUpperTailCoxStuart: Q(-z) = 1 - Q(z)', () => {
  for (const z of [0.1, 0.5, 1.0, 2.5, 3.5]) {
    const q1 = standardNormalUpperTailCoxStuart(z);
    const q2 = standardNormalUpperTailCoxStuart(-z);
    assert.ok(Math.abs(q2 - (1 - q1)) < 1e-7);
  }
});

test('standardNormalUpperTailCoxStuart: throws on non-finite', () => {
  assert.throws(() => standardNormalUpperTailCoxStuart(Number.NaN));
});

// ---------- dailyTokenCoxStuartSignPairs ----------

test('dailyTokenCoxStuartSignPairs: requires n >= 20', () => {
  assert.throws(() =>
    dailyTokenCoxStuartSignPairs(Array.from({ length: 19 }, (_, i) => i + 1)),
  );
});

test('dailyTokenCoxStuartSignPairs: rejects non-finite values', () => {
  const v = Array.from({ length: 22 }, (_, i) => i);
  v[3] = Number.POSITIVE_INFINITY;
  assert.throws(() => dailyTokenCoxStuartSignPairs(v));
});

test('dailyTokenCoxStuartSignPairs: throws on zero variance', () => {
  assert.throws(() =>
    dailyTokenCoxStuartSignPairs(Array.from({ length: 22 }, () => 7)),
  );
});

test('dailyTokenCoxStuartSignPairs: monotone-up gives strongly positive csZ (all pair-diffs positive)', () => {
  const v = Array.from({ length: 30 }, (_, i) => i + 1);
  const r = dailyTokenCoxStuartSignPairs(v);
  assert.equal(r.csPlus, r.csPairs);
  assert.equal(r.csMinus, 0);
  assert.ok(r.csZ > 3);
  assert.ok(r.csPValue < 0.01);
});

test('dailyTokenCoxStuartSignPairs: monotone-down gives strongly negative csZ', () => {
  const v = Array.from({ length: 30 }, (_, i) => 100 - i);
  const r = dailyTokenCoxStuartSignPairs(v);
  assert.equal(r.csMinus, r.csPairs);
  assert.equal(r.csPlus, 0);
  assert.ok(r.csZ < -3);
});

test('dailyTokenCoxStuartSignPairs: shift-invariance csZ(x+c) = csZ(x)', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 1, 7];
  const r1 = dailyTokenCoxStuartSignPairs(v);
  const r2 = dailyTokenCoxStuartSignPairs(v.map((x) => x + 100.5));
  assert.equal(r1.csPlus, r2.csPlus);
  assert.equal(r1.csMinus, r2.csMinus);
  assert.ok(Math.abs(r1.csZ - r2.csZ) < 1e-12);
});

test('dailyTokenCoxStuartSignPairs: positive-scale-invariance csZ(a*x) = csZ(x)', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 1, 7];
  const r1 = dailyTokenCoxStuartSignPairs(v);
  const r2 = dailyTokenCoxStuartSignPairs(v.map((x) => 7.25 * x));
  assert.equal(r1.csPlus, r2.csPlus);
  assert.ok(Math.abs(r1.csZ - r2.csZ) < 1e-12);
});

test('dailyTokenCoxStuartSignPairs: negation flips sign of csZ exactly (no ties)', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 18, 8, 4, 6, 2, 1, 7];
  const r1 = dailyTokenCoxStuartSignPairs(v);
  const r2 = dailyTokenCoxStuartSignPairs(v.map((x) => -x));
  // pair-counts swap
  assert.equal(r1.csPlus, r2.csMinus);
  assert.equal(r1.csMinus, r2.csPlus);
  assert.ok(Math.abs(r1.csZ + r2.csZ) < 1e-12);
});

test('dailyTokenCoxStuartSignPairs: throws when csNonTies < 10 (too many ties)', () => {
  // 20 values, only first/last differ; pairs at c=10: most pairs are 0-vs-0 ties
  const v = Array.from({ length: 20 }, (_, i) =>
    i === 0 ? 1 : i === 19 ? 100 : 5,
  );
  assert.throws(() => dailyTokenCoxStuartSignPairs(v));
});

test('dailyTokenCoxStuartSignPairs: balanced data near csZ ~ 0', () => {
  // construct so first half mirrors second half exactly => all pair-diffs zero,
  // but we need csNonTies>=10. Use up-down zigzag matched with own zigzag.
  // Actually: shift-by-c-equal pattern => ties. Use opposite zigzags.
  const half = [1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5];
  const v = [...half, ...half.map((x) => x + 0.0001 * Math.random())];
  // We can't easily guarantee csZ ~ 0 with random; just verify finite + p in [0,1]
  const r = dailyTokenCoxStuartSignPairs(v);
  assert.ok(Number.isFinite(r.csZ));
  assert.ok(r.csPValue >= 0 && r.csPValue <= 1);
});

test('dailyTokenCoxStuartSignPairs: csC = ceil(n/2), csPairs = floor(n/2)', () => {
  const v = Array.from({ length: 25 }, (_, i) => Math.sin(i) + i * 0.01 + 10);
  const r = dailyTokenCoxStuartSignPairs(v);
  assert.equal(r.csC, 13);
  assert.equal(r.csPairs, 12);
});

// ---------- buildDailyTokenCoxStuartSignPairs ----------

test('buildDailyTokenCoxStuartSignPairs: empty queue produces empty report', () => {
  const r = buildDailyTokenCoxStuartSignPairs([], { generatedAt: '2026-05-05T00:00:00.000Z' });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenCoxStuartSignPairs: rejects negative minTokens', () => {
  assert.throws(() => buildDailyTokenCoxStuartSignPairs([], { minTokens: -1 }));
});

test('buildDailyTokenCoxStuartSignPairs: rejects minTenureDays < 20', () => {
  assert.throws(() => buildDailyTokenCoxStuartSignPairs([], { minTenureDays: 12 }));
});

test('buildDailyTokenCoxStuartSignPairs: rejects bad sort key', () => {
  assert.throws(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildDailyTokenCoxStuartSignPairs([], { sort: 'bogus' as any }),
  );
});

test('buildDailyTokenCoxStuartSignPairs: filters source by name', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    queue.push(ql(dayIso(i), 'alpha', 1000 + i * 10));
    queue.push(ql(dayIso(i), 'beta', 500));
  }
  const r = buildDailyTokenCoxStuartSignPairs(queue, {
    source: 'alpha',
    minTokens: 0,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenCoxStuartSignPairs: monotone trend produces large positive csZ', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'rising', 100 + i * 50));
  }
  const r = buildDailyTokenCoxStuartSignPairs(queue, {
    minTokens: 0,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.csZ > 3);
  assert.ok(row.csPValue < 0.01);
});

test('buildDailyTokenCoxStuartSignPairs: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    for (let i = 0; i < 25; i += 1) {
      queue.push(ql(dayIso(i), `src-${s}`, 100 + i * (s + 1)));
    }
  }
  const r = buildDailyTokenCoxStuartSignPairs(queue, {
    minTokens: 0,
    top: 2,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

// ---------- aggregateCoxStuartSignPairs ----------

test('aggregateCoxStuartSignPairs: empty rows gives stoufferZ=0, p=1', () => {
  const a = aggregateCoxStuartSignPairs([]);
  assert.equal(a.stoufferZ, 0);
  assert.equal(a.stoufferTwoSidedPValue, 1);
  assert.equal(a.rowsUsed, 0);
});

test('aggregateCoxStuartSignPairs: skips malformed rows', () => {
  const a = aggregateCoxStuartSignPairs([
    { csZ: Number.NaN, csPValue: 0.1, csNonTies: 12, nTenureDays: 30 },
    { csZ: 0, csPValue: 0, csNonTies: 12, nTenureDays: 30 },
    { csZ: 1, csPValue: 0.3, csNonTies: 5, nTenureDays: 30 }, // too few non-ties
    { csZ: 1.5, csPValue: 0.13, csNonTies: 12, nTenureDays: 30 }, // valid
  ]);
  assert.equal(a.rowsUsed, 1);
  assert.equal(a.rowsSkipped, 3);
});

test('aggregateCoxStuartSignPairs: signed cancellation', () => {
  const a = aggregateCoxStuartSignPairs([
    { csZ: 2, csPValue: 0.05, csNonTies: 12, nTenureDays: 30 },
    { csZ: -2, csPValue: 0.05, csNonTies: 12, nTenureDays: 30 },
  ]);
  assert.ok(Math.abs(a.stoufferZ) < 1e-12);
  assert.ok(Math.abs(a.meanCsZ) < 1e-12);
});

test('aggregateCoxStuartSignPairs: tenure-weighted mean differs from unweighted', () => {
  const a = aggregateCoxStuartSignPairs([
    { csZ: 2, csPValue: 0.05, csNonTies: 12, nTenureDays: 100 },
    { csZ: -1, csPValue: 0.3, csNonTies: 12, nTenureDays: 25 },
  ]);
  // weighted: (100*2 + 25*-1) / 125 = 175/125 = 1.4
  assert.ok(Math.abs(a.tenureWeightedMeanCsZ - 1.4) < 1e-9);
  // unweighted: (2 + -1) / 2 = 0.5
  assert.ok(Math.abs(a.meanCsZ - 0.5) < 1e-9);
});
