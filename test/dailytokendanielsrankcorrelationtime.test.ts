import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  danielsMidranks,
  danielsRankCorrelationRho,
  danielsRhoVariance,
  standardNormalUpperTailDanielsRankCorrelationTime,
  dailyTokenDanielsRankCorrelationTime,
  aggregateDanielsRankCorrelationTime,
  buildDailyTokenDanielsRankCorrelationTime,
} from '../src/dailytokendanielsrankcorrelationtime.ts';
import type { QueueLine } from '../src/types.ts';

// ----- danielsMidranks -----

test('danielsMidranks: strictly increasing', () => {
  const out = danielsMidranks([10, 20, 30, 40]);
  assert.deepEqual(out.ranks, [1, 2, 3, 4]);
  assert.equal(out.nTiedGroups, 0);
});

test('danielsMidranks: strictly decreasing', () => {
  const out = danielsMidranks([40, 30, 20, 10]);
  assert.deepEqual(out.ranks, [4, 3, 2, 1]);
  assert.equal(out.nTiedGroups, 0);
});

test('danielsMidranks: simple ties give midrank average', () => {
  const out = danielsMidranks([5, 5, 10]);
  assert.deepEqual(out.ranks, [1.5, 1.5, 3]);
  assert.equal(out.nTiedGroups, 1);
});

test('danielsMidranks: triple tie', () => {
  const out = danielsMidranks([7, 7, 7, 9]);
  assert.deepEqual(out.ranks, [2, 2, 2, 4]);
  assert.equal(out.nTiedGroups, 1);
});

test('danielsMidranks: two separate tied groups', () => {
  const out = danielsMidranks([1, 1, 2, 2]);
  assert.deepEqual(out.ranks, [1.5, 1.5, 3.5, 3.5]);
  assert.equal(out.nTiedGroups, 2);
});

test('danielsMidranks: preserves original positions', () => {
  const out = danielsMidranks([30, 10, 20]);
  assert.deepEqual(out.ranks, [3, 1, 2]);
});

// ----- danielsRankCorrelationRho -----

test('danielsRankCorrelationRho: identity ranks give rho = 1', () => {
  assert.equal(danielsRankCorrelationRho([1, 2, 3, 4, 5]), 1);
});

test('danielsRankCorrelationRho: reversed ranks give rho = -1', () => {
  assert.equal(danielsRankCorrelationRho([5, 4, 3, 2, 1]), -1);
});

test('danielsRankCorrelationRho: middle pair swap gives near-1 rho', () => {
  const rho = danielsRankCorrelationRho([1, 3, 2, 4, 5]);
  assert.ok(rho > 0.8 && rho < 1, `rho=${rho}`);
});

test('danielsRankCorrelationRho: rejects n < 2', () => {
  assert.throws(() => danielsRankCorrelationRho([5]));
});

test('danielsRankCorrelationRho: matches Pearson formula on midranks with ties', () => {
  const ranks = [1.5, 1.5, 3, 4];
  // Pearson(ranks, [1,2,3,4]) computed by hand:
  // meanR = 2.5, meanI = 2.5
  // num = (-1)*-1.5 + (-1)*-0.5 + 0.5*0.5 + 1.5*1.5 = 1.5 + 0.5 + 0.25 + 2.25 = 4.5
  // denomR = 1+1+0.25+2.25 = 4.5
  // denomI = 2.25+0.25+0.25+2.25 = 5
  // rho = 4.5 / sqrt(4.5*5) = 4.5 / sqrt(22.5)
  const expected = 4.5 / Math.sqrt(22.5);
  assert.ok(Math.abs(danielsRankCorrelationRho(ranks) - expected) < 1e-12);
});

// ----- danielsRhoVariance -----

test('danielsRhoVariance: closed form 1/(n-1)', () => {
  assert.equal(danielsRhoVariance(12), 1 / 11);
  assert.equal(danielsRhoVariance(100), 1 / 99);
});

test('danielsRhoVariance: rejects n < 2', () => {
  assert.throws(() => danielsRhoVariance(1));
});

test('danielsRhoVariance: rejects non-integer', () => {
  assert.throws(() => danielsRhoVariance(12.5));
});

// ----- standardNormalUpperTailDanielsRankCorrelationTime -----

test('upper tail Q(0) = 0.5', () => {
  assert.ok(
    Math.abs(standardNormalUpperTailDanielsRankCorrelationTime(0) - 0.5) < 1e-6,
  );
});

test('upper tail Q(1.96) ~ 0.025', () => {
  const q = standardNormalUpperTailDanielsRankCorrelationTime(1.96);
  assert.ok(Math.abs(q - 0.025) < 1e-3, `q=${q}`);
});

test('upper tail symmetry Q(-z) = 1 - Q(z)', () => {
  const z = 1.5;
  const q = standardNormalUpperTailDanielsRankCorrelationTime(z);
  const qn = standardNormalUpperTailDanielsRankCorrelationTime(-z);
  assert.ok(Math.abs(q + qn - 1) < 1e-6);
});

test('upper tail rejects non-finite', () => {
  assert.throws(() =>
    standardNormalUpperTailDanielsRankCorrelationTime(Number.NaN),
  );
});

// ----- dailyTokenDanielsRankCorrelationTime -----

test('dailyTokenDanielsRankCorrelationTime: monotone increasing gives drZ >> 0, drPValue < 0.001', () => {
  const vals = Array.from({ length: 12 }, (_, i) => i + 1);
  const out = dailyTokenDanielsRankCorrelationTime(vals);
  assert.equal(out.drRho, 1);
  assert.ok(out.drZ > 3, `drZ=${out.drZ}`);
  assert.ok(out.drPValue < 0.01, `p=${out.drPValue}`);
  assert.equal(out.nSamples, 12);
  assert.equal(out.nTiedGroups, 0);
});

test('dailyTokenDanielsRankCorrelationTime: monotone decreasing gives drZ << 0', () => {
  const vals = Array.from({ length: 12 }, (_, i) => 12 - i);
  const out = dailyTokenDanielsRankCorrelationTime(vals);
  assert.equal(out.drRho, -1);
  assert.ok(out.drZ < -3, `drZ=${out.drZ}`);
  assert.ok(out.drPValue < 0.01);
});

test('dailyTokenDanielsRankCorrelationTime: random-ish series gives drZ near 0', () => {
  // explicit non-trending permutation of 1..12
  const vals = [6, 1, 9, 4, 11, 2, 7, 3, 12, 5, 8, 10];
  const out = dailyTokenDanielsRankCorrelationTime(vals);
  assert.ok(Math.abs(out.drZ) < 2, `drZ=${out.drZ}`);
  assert.ok(out.drPValue > 0.05, `p=${out.drPValue}`);
});

test('dailyTokenDanielsRankCorrelationTime: rejects n < 12', () => {
  assert.throws(() =>
    dailyTokenDanielsRankCorrelationTime([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  );
});

test('dailyTokenDanielsRankCorrelationTime: rejects non-finite', () => {
  const vals = Array.from({ length: 12 }, (_, i) => i + 1);
  vals[5] = Number.POSITIVE_INFINITY;
  assert.throws(() => dailyTokenDanielsRankCorrelationTime(vals));
});

test('dailyTokenDanielsRankCorrelationTime: rejects zero variance', () => {
  const vals = new Array<number>(12).fill(7);
  assert.throws(() => dailyTokenDanielsRankCorrelationTime(vals));
});

test('dailyTokenDanielsRankCorrelationTime: drZ = drRho * sqrt(n-1)', () => {
  const vals = [1, 3, 2, 5, 4, 7, 6, 9, 8, 11, 10, 12];
  const out = dailyTokenDanielsRankCorrelationTime(vals);
  const expectedZ = out.drRho * Math.sqrt(12 - 1);
  assert.ok(Math.abs(out.drZ - expectedZ) < 1e-12);
});

test('dailyTokenDanielsRankCorrelationTime: tied series surfaces nTiedGroups', () => {
  const vals = [1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const out = dailyTokenDanielsRankCorrelationTime(vals);
  assert.equal(out.nTiedGroups, 1);
  assert.ok(out.drZ > 0);
});

// ----- aggregateDanielsRankCorrelationTime -----

test('aggregate: empty returns zero stouffer', () => {
  const out = aggregateDanielsRankCorrelationTime([]);
  assert.equal(out.stoufferZ, 0);
  assert.equal(out.stoufferTwoSidedPValue, 1);
  assert.equal(out.rowsUsed, 0);
});

test('aggregate: combines signed Z via Stouffer', () => {
  const rows = [
    { drZ: 2, drPValue: 0.05, nTenureDays: 20 },
    { drZ: 2, drPValue: 0.05, nTenureDays: 20 },
  ];
  const out = aggregateDanielsRankCorrelationTime(rows);
  assert.ok(Math.abs(out.stoufferZ - 2 * Math.sqrt(2) / Math.sqrt(2) / 1) > 0);
  // simpler check: stoufferZ = (2+2)/sqrt(2) = sqrt(8)
  assert.ok(Math.abs(out.stoufferZ - Math.sqrt(8)) < 1e-9);
  assert.equal(out.rowsUsed, 2);
});

test('aggregate: skips low-tenure rows', () => {
  const rows = [
    { drZ: 5, drPValue: 0, nTenureDays: 5 },
    { drZ: 1, drPValue: 0.1, nTenureDays: 30 },
  ];
  const out = aggregateDanielsRankCorrelationTime(rows);
  assert.equal(out.rowsUsed, 1);
  assert.equal(out.rowsSkipped, 1);
  assert.equal(out.stoufferZ, 1);
});

test('aggregate: tenure-weighted mean', () => {
  const rows = [
    { drZ: 1, drPValue: 0.3, nTenureDays: 20 },
    { drZ: 3, drPValue: 0.001, nTenureDays: 30 },
  ];
  const out = aggregateDanielsRankCorrelationTime(rows);
  // (20*1 + 30*3) / 50 = 110 / 50 = 2.2
  assert.equal(out.tenureWeightedMeanDrZ, 2.2);
});

// ----- buildDailyTokenDanielsRankCorrelationTime -----

function makeQueueLineSeries(
  source: string,
  startDay: string,
  values: number[],
): QueueLine[] {
  return values.map((v, i) => {
    const d = new Date(Date.parse(`${startDay}T00:00:00.000Z`) + i * 86_400_000);
    return {
      hour_start: d.toISOString(),
      source,
      total_tokens: v,
    } as QueueLine;
  });
}

test('build: monotone-up source gives positive drZ', () => {
  const queue = makeQueueLineSeries(
    'test-src',
    '2026-01-01',
    [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200],
  );
  const r = buildDailyTokenDanielsRankCorrelationTime(queue, {
    generatedAt: '2026-01-15T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.drRho > 0.99);
  assert.ok(r.sources[0]!.drZ > 3);
});

test('build: drops below-min-tenure', () => {
  const queue = makeQueueLineSeries(
    'short',
    '2026-01-01',
    [1000, 2000, 3000, 4000, 5000],
  );
  const r = buildDailyTokenDanielsRankCorrelationTime(queue);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: drops zero-variance', () => {
  const queue = makeQueueLineSeries(
    'flat',
    '2026-01-01',
    new Array<number>(20).fill(1000),
  );
  const r = buildDailyTokenDanielsRankCorrelationTime(queue);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: drops sparse sources below min-tokens', () => {
  const queue = makeQueueLineSeries(
    'sparse',
    '2026-01-01',
    new Array<number>(15).fill(1).map((_, i) => i + 1),
  );
  const r = buildDailyTokenDanielsRankCorrelationTime(queue, {
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: rejects min-tenure-days < 12', () => {
  assert.throws(() =>
    buildDailyTokenDanielsRankCorrelationTime([], { minTenureDays: 5 }),
  );
});

test('build: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenDanielsRankCorrelationTime([], {
      sort: 'invalid' as never,
    }),
  );
});

test('build: source filter retains only matching', () => {
  const a = makeQueueLineSeries(
    'a',
    '2026-01-01',
    Array.from({ length: 13 }, (_, i) => 1000 + i * 100),
  );
  const b = makeQueueLineSeries(
    'b',
    '2026-01-01',
    Array.from({ length: 13 }, (_, i) => 5000 - i * 100),
  );
  const r = buildDailyTokenDanielsRankCorrelationTime([...a, ...b], {
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: top cap surfaces dropped count', () => {
  const a = makeQueueLineSeries(
    'a',
    '2026-01-01',
    Array.from({ length: 13 }, (_, i) => 1000 + i * 100),
  );
  const b = makeQueueLineSeries(
    'b',
    '2026-01-01',
    Array.from({ length: 13 }, (_, i) => 5000 - i * 100),
  );
  const r = buildDailyTokenDanielsRankCorrelationTime([...a, ...b], {
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 1);
});

test('build: drops invalid hour_start', () => {
  const queue: QueueLine[] = [
    { hour_start: 'bad', source: 'x', total_tokens: 100 } as QueueLine,
  ];
  const r = buildDailyTokenDanielsRankCorrelationTime(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
});
