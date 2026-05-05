import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenFlignerKilleenHalves,
  buildDailyTokenFlignerKilleenHalves,
  midRanksFlignerKilleen,
  medianFlignerKilleen,
  inverseStandardNormalCdfFlignerKilleen,
  standardNormalUpperTailFlignerKilleen,
} from '../src/dailytokenflignerkilleenhalves.js';
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

// ---------- helpers ----------

test('medianFlignerKilleen: odd length', () => {
  assert.equal(medianFlignerKilleen([3, 1, 2]), 2);
});

test('medianFlignerKilleen: even length', () => {
  assert.equal(medianFlignerKilleen([4, 1, 2, 3]), 2.5);
});

test('medianFlignerKilleen: empty throws', () => {
  assert.throws(() => medianFlignerKilleen([]), /empty/);
});

test('midRanksFlignerKilleen: distinct values', () => {
  assert.deepEqual(midRanksFlignerKilleen([10, 20, 30]), [1, 2, 3]);
});

test('midRanksFlignerKilleen: tied values get mid-ranks', () => {
  // values [5,5,10]: ranks at positions 1,2 tied -> 1.5 each
  assert.deepEqual(midRanksFlignerKilleen([5, 5, 10]), [1.5, 1.5, 3]);
});

test('inverseStandardNormalCdfFlignerKilleen: 0.5 -> 0', () => {
  assert.ok(Math.abs(inverseStandardNormalCdfFlignerKilleen(0.5)) < 1e-9);
});

test('inverseStandardNormalCdfFlignerKilleen: ~0.975 -> ~1.96', () => {
  const z = inverseStandardNormalCdfFlignerKilleen(0.975);
  assert.ok(Math.abs(z - 1.96) < 0.01);
});

test('standardNormalUpperTailFlignerKilleen: Q(0) = 0.5', () => {
  assert.ok(
    Math.abs(standardNormalUpperTailFlignerKilleen(0) - 0.5) < 1e-6,
  );
});

test('standardNormalUpperTailFlignerKilleen: Q(1.96) ~ 0.025', () => {
  assert.ok(
    Math.abs(standardNormalUpperTailFlignerKilleen(1.96) - 0.025) < 0.001,
  );
});

// ---------- core: Fligner-Killeen ----------

test('dailyTokenFlignerKilleenHalves: rejects too few samples', () => {
  assert.throws(
    () => dailyTokenFlignerKilleenHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
    /at least 16 samples/,
  );
});

test('dailyTokenFlignerKilleenHalves: rejects non-finite values', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, NaN];
  assert.throws(
    () => dailyTokenFlignerKilleenHalves(v),
    /finite values/,
  );
});

test('dailyTokenFlignerKilleenHalves: rejects zero variance', () => {
  const v = new Array(16).fill(7);
  assert.throws(
    () => dailyTokenFlignerKilleenHalves(v),
    /zero centred variance/,
  );
});

test('dailyTokenFlignerKilleenHalves: equal-dispersion halves give small fkX2', () => {
  // Two halves with same dispersion around different medians.
  // FK should NOT reject under H0.
  const v = [
    10, 12, 8, 11, 9, 13, 7, 14,        // A: median 10.5
    100, 102, 98, 101, 99, 103, 97, 104, // B: median 100.5
  ];
  const r = dailyTokenFlignerKilleenHalves(v);
  assert.equal(r.fkN1, 8);
  assert.equal(r.fkN2, 8);
  assert.ok(r.fkX2 < 1, `expected small fkX2 under H0 (got ${r.fkX2})`);
  assert.ok(r.fkPValue > 0.1, `expected large p (got ${r.fkPValue})`);
});

test('dailyTokenFlignerKilleenHalves: B much more dispersed -> fkZ > 0', () => {
  const v = [
    10, 11, 9, 11, 9, 10, 11, 9,           // A: tight around 10
    50, 200, 1, 300, 5, 400, 2, 500,       // B: huge spread
  ];
  const r = dailyTokenFlignerKilleenHalves(v);
  assert.ok(r.fkZ > 1.5, `expected fkZ > 1.5 (got ${r.fkZ})`);
  assert.ok(r.fkPValue < 0.2, `expected small p (got ${r.fkPValue})`);
});

test('dailyTokenFlignerKilleenHalves: A much more dispersed -> fkZ < 0', () => {
  const v = [
    50, 200, 1, 300, 5, 400, 2, 500,       // A: huge spread
    10, 11, 9, 11, 9, 10, 11, 9,           // B: tight around 10
  ];
  const r = dailyTokenFlignerKilleenHalves(v);
  assert.ok(r.fkZ < -1.5, `expected fkZ < -1.5 (got ${r.fkZ})`);
  assert.ok(r.fkPValue < 0.2, `expected small p (got ${r.fkPValue})`);
});

test('dailyTokenFlignerKilleenHalves: shift invariance fkZ(x+c) = fkZ(x)', () => {
  const v = [10, 12, 8, 11, 9, 13, 7, 14, 50, 200, 1, 300, 5, 400, 2, 500];
  const r1 = dailyTokenFlignerKilleenHalves(v);
  const r2 = dailyTokenFlignerKilleenHalves(v.map((x) => x + 1000));
  assert.ok(Math.abs(r1.fkZ - r2.fkZ) < 1e-9);
  assert.ok(Math.abs(r1.fkX2 - r2.fkX2) < 1e-9);
});

test('dailyTokenFlignerKilleenHalves: positive scale invariance fkZ(a*x) = fkZ(x)', () => {
  const v = [10, 12, 8, 11, 9, 13, 7, 14, 50, 200, 1, 300, 5, 400, 2, 500];
  const r1 = dailyTokenFlignerKilleenHalves(v);
  const r2 = dailyTokenFlignerKilleenHalves(v.map((x) => 7 * x));
  assert.ok(Math.abs(r1.fkZ - r2.fkZ) < 1e-9);
  assert.ok(Math.abs(r1.fkX2 - r2.fkX2) < 1e-9);
});

test('dailyTokenFlignerKilleenHalves: independent half-shifts preserve fkZ', () => {
  const v = [10, 12, 8, 11, 9, 13, 7, 14, 50, 200, 1, 300, 5, 400, 2, 500];
  const shifted = [
    ...v.slice(0, 8).map((x) => x + 5000),
    ...v.slice(8).map((x) => x - 200),
  ];
  const r1 = dailyTokenFlignerKilleenHalves(v);
  const r2 = dailyTokenFlignerKilleenHalves(shifted);
  assert.ok(Math.abs(r1.fkZ - r2.fkZ) < 1e-9);
});

test('dailyTokenFlignerKilleenHalves: fkX2 = fkZ^2 identity', () => {
  const v = [10, 11, 9, 11, 9, 10, 11, 9, 50, 200, 1, 300, 5, 400, 2, 500];
  const r = dailyTokenFlignerKilleenHalves(v);
  assert.ok(Math.abs(r.fkX2 - r.fkZ * r.fkZ) < 1e-9);
});

test('dailyTokenFlignerKilleenHalves: pValue in [0,1]', () => {
  const v = [10, 12, 8, 11, 9, 13, 7, 14, 50, 200, 1, 300, 5, 400, 2, 500];
  const r = dailyTokenFlignerKilleenHalves(v);
  assert.ok(r.fkPValue >= 0 && r.fkPValue <= 1);
});

test('dailyTokenFlignerKilleenHalves: returns correct n1, n2 for n=17', () => {
  const v = Array.from({ length: 17 }, (_, i) => (i + 1) * 3 + (i % 2));
  const r = dailyTokenFlignerKilleenHalves(v);
  assert.equal(r.fkN1, 8);
  assert.equal(r.fkN2, 9);
  assert.equal(r.nSamples, 17);
});

test('dailyTokenFlignerKilleenHalves: builder returns score variance > 0', () => {
  const v = [10, 12, 8, 11, 9, 13, 7, 14, 50, 200, 1, 300, 5, 400, 2, 500];
  const r = dailyTokenFlignerKilleenHalves(v);
  assert.ok(r.fkScoreVar > 0);
});

// ---------- builder ----------

test('buildDailyTokenFlignerKilleenHalves: rejects min-tenure-days < 16', () => {
  assert.throws(
    () => buildDailyTokenFlignerKilleenHalves([], { minTenureDays: 10 }),
    />= 16/,
  );
});

test('buildDailyTokenFlignerKilleenHalves: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenFlignerKilleenHalves([], {
        sort: 'nonsense' as 'fkZ',
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenFlignerKilleenHalves: rejects negative minTokens', () => {
  assert.throws(
    () => buildDailyTokenFlignerKilleenHalves([], { minTokens: -1 }),
    /non-negative/,
  );
});

test('buildDailyTokenFlignerKilleenHalves: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenFlignerKilleenHalves([], { top: -3 }),
    /non-negative integer/,
  );
});

test('buildDailyTokenFlignerKilleenHalves: empty queue -> empty report', () => {
  const r = buildDailyTokenFlignerKilleenHalves([], { generatedAt: '2026-05-05T00:00:00.000Z' });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('buildDailyTokenFlignerKilleenHalves: builds a row for a synthetic 16-day source', () => {
  const queue: QueueLine[] = [];
  // 16 days, dispersion grows in the second half.
  const tokens = [
    1000, 1100, 950, 1050, 980, 1020, 1010, 990,           // A: tight
    500, 2000, 100, 3000, 50, 4000, 200, 5000,             // B: spread
  ];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src1', tokens[i]!));
  }
  const r = buildDailyTokenFlignerKilleenHalves(queue, {
    minTokens: 1000,
    minTenureDays: 16,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'src1');
  assert.equal(s.fkN1, 8);
  assert.equal(s.fkN2, 8);
  // Second half is more dispersed -> fkZ > 0.
  assert.ok(s.fkZ > 0, `expected fkZ > 0 (got ${s.fkZ})`);
  assert.ok(s.fkPValue >= 0 && s.fkPValue <= 1);
});

test('buildDailyTokenFlignerKilleenHalves: drops sparse sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) queue.push(ql(dayIso(i), 'tiny', 5));
  const r = buildDailyTokenFlignerKilleenHalves(queue, {
    minTokens: 1000,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenFlignerKilleenHalves: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) queue.push(ql(dayIso(i), 'flat', 100));
  const r = buildDailyTokenFlignerKilleenHalves(queue, {
    minTokens: 100,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenFlignerKilleenHalves: source filter respected', () => {
  const queue: QueueLine[] = [];
  const tokens = [1000, 1100, 950, 1050, 980, 1020, 1010, 990, 500, 2000, 100, 3000, 50, 4000, 200, 5000];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'a', tokens[i]!));
    queue.push(ql(dayIso(i), 'b', tokens[i]!));
  }
  const r = buildDailyTokenFlignerKilleenHalves(queue, {
    source: 'a',
    minTokens: 1000,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenFlignerKilleenHalves: top cap respected', () => {
  const queue: QueueLine[] = [];
  const tokens = [1000, 1100, 950, 1050, 980, 1020, 1010, 990, 500, 2000, 100, 3000, 50, 4000, 200, 5000];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 16; i += 1) {
      queue.push(ql(dayIso(i), src, tokens[i]!));
    }
  }
  const r = buildDailyTokenFlignerKilleenHalves(queue, {
    minTokens: 1000,
    top: 2,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenFlignerKilleenHalves: deterministic across two builds', () => {
  const queue: QueueLine[] = [];
  const tokens = [1000, 1100, 950, 1050, 980, 1020, 1010, 990, 500, 2000, 100, 3000, 50, 4000, 200, 5000];
  for (let i = 0; i < 16; i += 1) queue.push(ql(dayIso(i), 's', tokens[i]!));
  const r1 = buildDailyTokenFlignerKilleenHalves(queue, {
    minTokens: 1000,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  const r2 = buildDailyTokenFlignerKilleenHalves(queue, {
    minTokens: 1000,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.deepEqual(r1, r2);
});
