import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenNoetherCyclicalTrend,
  buildDailyTokenNoetherCyclicalTrend,
  countMonotonicTripletsNoether,
  makeSplitMix32Noether,
  fnv1aSeedNoether,
  standardNormalUpperTailNoether,
  aggregateNoetherCyclicalTrend,
} from '../src/dailytokennoethercyclicaltrend.js';
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

// ---------- countMonotonicTripletsNoether ----------

test('countMonotonicTripletsNoether: strictly increasing series, lag 2', () => {
  const v = [1, 2, 3, 4, 5, 6, 7];
  const r = countMonotonicTripletsNoether(v, 2);
  assert.equal(r.triplets, 3); // (0,2,4)(1,3,5)(2,4,6)
  assert.equal(r.m, 3);
  assert.equal(r.ties, 0);
});

test('countMonotonicTripletsNoether: strictly decreasing series, lag 2', () => {
  const v = [9, 7, 6, 5, 4, 3, 2];
  const r = countMonotonicTripletsNoether(v, 2);
  assert.equal(r.m, r.triplets);
  assert.equal(r.ties, 0);
});

test('countMonotonicTripletsNoether: all-equal series ties out every triplet', () => {
  const v = [5, 5, 5, 5, 5, 5, 5];
  const r = countMonotonicTripletsNoether(v, 2);
  assert.equal(r.m, 0);
  assert.equal(r.ties, r.triplets);
});

test('countMonotonicTripletsNoether: lag must be positive integer', () => {
  assert.throws(() => countMonotonicTripletsNoether([1, 2, 3], 0));
  assert.throws(() => countMonotonicTripletsNoether([1, 2, 3], 1.5));
});

test('countMonotonicTripletsNoether: lag-1 reduces to anti-Wallis-Moore (sanity)', () => {
  // alternating up/down zig-zag has zero monotonic adjacent triplets
  const v = [1, 5, 2, 6, 3, 7, 4, 8];
  const r = countMonotonicTripletsNoether(v, 1);
  assert.equal(r.m, 0);
});

test('countMonotonicTripletsNoether: lag larger than series gives zero', () => {
  const r = countMonotonicTripletsNoether([1, 2, 3], 5);
  assert.equal(r.triplets, 0);
  assert.equal(r.m, 0);
});

// ---------- PRNG primitives ----------

test('makeSplitMix32Noether: deterministic given the same seed', () => {
  const a = makeSplitMix32Noether(42);
  const b = makeSplitMix32Noether(42);
  for (let i = 0; i < 100; i += 1) assert.equal(a(), b());
});

test('makeSplitMix32Noether: outputs in [0, 1)', () => {
  const r = makeSplitMix32Noether(12345);
  for (let i = 0; i < 1000; i += 1) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});

test('fnv1aSeedNoether: deterministic for the same input', () => {
  assert.equal(fnv1aSeedNoether([1, 2, 3]), fnv1aSeedNoether([1, 2, 3]));
});

test('fnv1aSeedNoether: different inputs give different seeds', () => {
  assert.notEqual(fnv1aSeedNoether([1, 2, 3]), fnv1aSeedNoether([1, 2, 4]));
});

test('fnv1aSeedNoether: never returns 0', () => {
  for (let i = 0; i < 100; i += 1) assert.notEqual(fnv1aSeedNoether([i]), 0);
});

// ---------- standardNormalUpperTailNoether ----------

test('standardNormalUpperTailNoether: Q(0) ~ 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailNoether(0) - 0.5) < 1e-7);
});

test('standardNormalUpperTailNoether: Q(1.96) ~ 0.025', () => {
  assert.ok(Math.abs(standardNormalUpperTailNoether(1.96) - 0.025) < 1e-4);
});

test('standardNormalUpperTailNoether: Q(-z) = 1 - Q(z)', () => {
  for (const z of [0.1, 0.5, 1.0, 2.5, 3.5]) {
    const q1 = standardNormalUpperTailNoether(z);
    const q2 = standardNormalUpperTailNoether(-z);
    assert.ok(Math.abs(q2 - (1 - q1)) < 1e-7);
  }
});

// ---------- dailyTokenNoetherCyclicalTrend ----------

test('dailyTokenNoetherCyclicalTrend: lag must be >= 2', () => {
  assert.throws(
    () => dailyTokenNoetherCyclicalTrend([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 1),
    /lag must be an integer >= 2/,
  );
});

test('dailyTokenNoetherCyclicalTrend: requires enough samples for lag', () => {
  assert.throws(
    () => dailyTokenNoetherCyclicalTrend([1, 2, 3, 4, 5], 2),
    /at least/,
  );
});

test('dailyTokenNoetherCyclicalTrend: requires finite values', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, NaN, 12];
  assert.throws(() => dailyTokenNoetherCyclicalTrend(v, 2), /finite/);
});

test('dailyTokenNoetherCyclicalTrend: zero variance throws', () => {
  const v = new Array(20).fill(7);
  assert.throws(() => dailyTokenNoetherCyclicalTrend(v, 2), /zero centred/);
});

test('dailyTokenNoetherCyclicalTrend: permutations must be >= 200', () => {
  const v = [1, 3, 2, 5, 4, 7, 6, 9, 8, 11, 10, 13];
  assert.throws(
    () => dailyTokenNoetherCyclicalTrend(v, 2, 100),
    /permutations must be an integer >= 200/,
  );
});

test('dailyTokenNoetherCyclicalTrend: strictly increasing => maximum noetherM', () => {
  const v = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenNoetherCyclicalTrend(v, 2, 500);
  assert.equal(r.noetherM, r.noetherTriplets);
  assert.equal(r.noetherTies, 0);
  assert.ok(r.noetherZ > 0, `expected noetherZ > 0 for strict ramp, got ${r.noetherZ}`);
});

test('dailyTokenNoetherCyclicalTrend: strictly decreasing => maximum noetherM', () => {
  const v = Array.from({ length: 20 }, (_, i) => 100 - i);
  const r = dailyTokenNoetherCyclicalTrend(v, 2, 500);
  assert.equal(r.noetherM, r.noetherTriplets);
  assert.ok(r.noetherZ > 0);
});

test('dailyTokenNoetherCyclicalTrend: identity under positive affine transform (signal preserved)', () => {
  const v = [1.1, 3.2, 2.4, 5.6, 4.8, 7.9, 6.1, 9.3, 8.5, 11.7, 10.9, 13.0, 12.2, 15.4];
  const r1 = dailyTokenNoetherCyclicalTrend(v, 2, 1000);
  const v2 = v.map((x) => 100 + 7 * x);
  const r2 = dailyTokenNoetherCyclicalTrend(v2, 2, 1000);
  assert.equal(r1.noetherM, r2.noetherM);
  assert.equal(r1.noetherTriplets, r2.noetherTriplets);
});

test('dailyTokenNoetherCyclicalTrend: deterministic given the same input', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3];
  const r1 = dailyTokenNoetherCyclicalTrend(v, 2, 1000);
  const r2 = dailyTokenNoetherCyclicalTrend(v, 2, 1000);
  assert.equal(r1.noetherZ, r2.noetherZ);
  assert.equal(r1.noetherVar, r2.noetherVar);
  assert.equal(r1.noetherPValue, r2.noetherPValue);
});

test('dailyTokenNoetherCyclicalTrend: noetherExpM = triplets/3', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7];
  const r = dailyTokenNoetherCyclicalTrend(v, 2, 500);
  assert.ok(Math.abs(r.noetherExpM - r.noetherTriplets / 3) < 1e-12);
});

test('dailyTokenNoetherCyclicalTrend: pValue in [0, 1]', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7];
  const r = dailyTokenNoetherCyclicalTrend(v, 2, 500);
  assert.ok(r.noetherPValue >= 0 && r.noetherPValue <= 1);
});

// ---------- aggregateNoetherCyclicalTrend ----------

test('aggregateNoetherCyclicalTrend: empty rows => rowsUsed=0', () => {
  const a = aggregateNoetherCyclicalTrend([]);
  assert.equal(a.rowsUsed, 0);
  assert.equal(a.stoufferZ, 0);
});

test('aggregateNoetherCyclicalTrend: skips malformed rows', () => {
  const a = aggregateNoetherCyclicalTrend([
    { noetherZ: NaN, noetherPValue: 0.5, noetherVar: 1, nTenureDays: 10 },
    { noetherZ: 1, noetherPValue: 0.3, noetherVar: 1, nTenureDays: 10 },
    { noetherZ: 2, noetherPValue: 0.04, noetherVar: 1, nTenureDays: 20 },
  ]);
  assert.equal(a.rowsUsed, 2);
  assert.equal(a.rowsSkipped, 1);
  assert.ok(Math.abs(a.stoufferZ - (1 + 2) / Math.sqrt(2)) < 1e-12);
});

test('aggregateNoetherCyclicalTrend: tenure-weighted mean correct', () => {
  const a = aggregateNoetherCyclicalTrend([
    { noetherZ: 1, noetherPValue: 0.3, noetherVar: 1, nTenureDays: 10 },
    { noetherZ: 3, noetherPValue: 0.001, noetherVar: 1, nTenureDays: 30 },
  ]);
  // weighted = (10*1 + 30*3) / (40) = 100/40 = 2.5
  assert.ok(Math.abs(a.tenureWeightedMeanNoetherZ - 2.5) < 1e-12);
  assert.ok(Math.abs(a.meanNoetherZ - 2) < 1e-12);
});

// ---------- buildDailyTokenNoetherCyclicalTrend ----------

test('buildDailyTokenNoetherCyclicalTrend: empty queue => zero rows', () => {
  const r = buildDailyTokenNoetherCyclicalTrend([], { generatedAt: '2026-05-05T00:00:00.000Z' });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('buildDailyTokenNoetherCyclicalTrend: builder happy path with synthetic source', () => {
  const lines: QueueLine[] = [];
  // 20-day series with strict-ramp signal
  for (let i = 0; i < 20; i += 1) {
    lines.push(ql(dayIso(i), 'src-a', 1000 + i * 50));
  }
  const r = buildDailyTokenNoetherCyclicalTrend(lines, {
    generatedAt: '2026-05-05T00:00:00.000Z',
    permutations: 500,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src-a');
  assert.equal(row.noetherLag, 2);
  assert.ok(row.noetherZ > 0, `strict ramp should give noetherZ > 0, got ${row.noetherZ}`);
  assert.equal(row.noetherM, row.noetherTriplets);
});

test('buildDailyTokenNoetherCyclicalTrend: minTenureDays floor enforced for lag', () => {
  assert.throws(
    () =>
      buildDailyTokenNoetherCyclicalTrend([], {
        noetherLag: 3,
        minTenureDays: 10, // floor for lag 3 is 12
      }),
    /minTenureDays must be an integer >= 12/,
  );
});

test('buildDailyTokenNoetherCyclicalTrend: lag 1 rejected', () => {
  assert.throws(
    () => buildDailyTokenNoetherCyclicalTrend([], { noetherLag: 1 }),
    /noetherLag must be an integer >= 2/,
  );
});

test('buildDailyTokenNoetherCyclicalTrend: invalid sort rejected', () => {
  assert.throws(
    () => buildDailyTokenNoetherCyclicalTrend([], { sort: 'foo' as never }),
    /sort must be one of/,
  );
});

test('buildDailyTokenNoetherCyclicalTrend: permutations must be >= 200', () => {
  assert.throws(
    () => buildDailyTokenNoetherCyclicalTrend([], { permutations: 50 }),
    /permutations must be an integer >= 200/,
  );
});

test('buildDailyTokenNoetherCyclicalTrend: zero-variance source dropped', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    lines.push(ql(dayIso(i), 'flat-src', 7777));
  }
  const r = buildDailyTokenNoetherCyclicalTrend(lines, {
    permutations: 500,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});
