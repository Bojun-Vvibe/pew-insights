import test from 'node:test';
import assert from 'node:assert/strict';
import {
  kolmogorovSurvival,
  bartlettCumulativePeriodogramStatistic,
  dailyTokenBartlettCumulativePeriodogram,
  buildDailyTokenBartlettCumulativePeriodogram,
} from '../src/dailytokenbartlettcumulativeperiodogram.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    hour_start,
    source,
    total_tokens,
  } as unknown as QueueLine;
}

function dayIso(i: number): string {
  return (
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z'
  );
}

// ---------- kolmogorovSurvival ----------

test('kolmogorovSurvival: lambda <= 0 -> p = 1', () => {
  assert.equal(kolmogorovSurvival(0), 1);
  assert.equal(kolmogorovSurvival(-1), 1);
});

test('kolmogorovSurvival: large lambda -> p ~ 0', () => {
  assert.ok(kolmogorovSurvival(10) < 1e-50);
});

test('kolmogorovSurvival: result in [0, 1]', () => {
  for (let l = 0.1; l < 5; l += 0.1) {
    const p = kolmogorovSurvival(l);
    assert.ok(p >= 0 && p <= 1, `lambda=${l} -> p=${p} out of [0,1]`);
  }
});

test('kolmogorovSurvival: monotone non-increasing in lambda', () => {
  let prev = Infinity;
  for (let l = 0.1; l < 5; l += 0.1) {
    const p = kolmogorovSurvival(l);
    assert.ok(p <= prev + 1e-12, `non-monotone at lambda=${l}: ${p} > ${prev}`);
    prev = p;
  }
});

test('kolmogorovSurvival: known reference values', () => {
  // Standard Kolmogorov critical values:
  // P(K > 1.358) ~ 0.05; P(K > 1.628) ~ 0.01
  assert.ok(Math.abs(kolmogorovSurvival(1.358) - 0.05) < 0.01);
  assert.ok(Math.abs(kolmogorovSurvival(1.628) - 0.01) < 0.005);
});

test('kolmogorovSurvival: rejects non-finite input', () => {
  assert.throws(() => kolmogorovSurvival(Number.NaN));
  assert.throws(() => kolmogorovSurvival(Infinity));
});

// ---------- bartlettCumulativePeriodogramStatistic ----------

test('bartlett: uniform spectrum -> bD = 0, bPValue = 1', () => {
  const power = [1, 1, 1, 1, 1, 1, 1, 1];
  const r = bartlettCumulativePeriodogramStatistic(power);
  assert.equal(r.bD, 0);
  assert.equal(r.bLambda, 0);
  assert.equal(r.bPValue, 1);
  assert.equal(r.bSignedDevPositive, 0);
  assert.equal(r.bSignedDevNegative, 0);
});

test('bartlett: spike at first bin -> bD = (K-1)/K, devPos = (K-1)/K', () => {
  const K = 10;
  const power = new Array(K).fill(0);
  power[0] = 1;
  const r = bartlettCumulativePeriodogramStatistic(power);
  assert.ok(Math.abs(r.bD - (K - 1) / K) < 1e-12);
  assert.ok(Math.abs(r.bSignedDevPositive - (K - 1) / K) < 1e-12);
  assert.equal(r.bSignedDevNegative, 0);
  assert.equal(r.bArgMaxBin, 1);
});

test('bartlett: spike at last bin -> bD = (K-1)/K, devNeg = -(K-1)/K', () => {
  const K = 10;
  const power = new Array(K).fill(0);
  power[K - 1] = 1;
  const r = bartlettCumulativePeriodogramStatistic(power);
  assert.ok(Math.abs(r.bD - (K - 1) / K) < 1e-12);
  assert.equal(r.bSignedDevPositive, 0);
  assert.ok(Math.abs(r.bSignedDevNegative + (K - 1) / K) < 1e-12);
  assert.equal(r.bArgMaxBin, K - 1);
});

test('bartlett: rejects too few bins', () => {
  assert.throws(() => bartlettCumulativePeriodogramStatistic([1]));
});

test('bartlett: rejects negative power', () => {
  assert.throws(() => bartlettCumulativePeriodogramStatistic([1, -1, 2]));
});

test('bartlett: rejects non-finite power', () => {
  assert.throws(() => bartlettCumulativePeriodogramStatistic([1, Number.NaN, 2]));
});

test('bartlett: rejects all-zero spectrum', () => {
  assert.throws(() => bartlettCumulativePeriodogramStatistic([0, 0, 0, 0]));
});

test('bartlett: scale invariance (multiplying all bins preserves bD)', () => {
  const power = [1, 2, 3, 4, 5, 1, 2, 3];
  const r1 = bartlettCumulativePeriodogramStatistic(power);
  const r2 = bartlettCumulativePeriodogramStatistic(power.map((p) => p * 1000));
  assert.ok(Math.abs(r1.bD - r2.bD) < 1e-12);
  assert.ok(Math.abs(r1.bPValue - r2.bPValue) < 1e-12);
});

test('bartlett: bD bounded in [0, 1)', () => {
  const cases = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [10, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 10],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  ];
  for (const c of cases) {
    const r = bartlettCumulativePeriodogramStatistic(c);
    assert.ok(r.bD >= 0 && r.bD < 1, `bD=${r.bD} out of bound`);
    assert.ok(r.bPValue >= 0 && r.bPValue <= 1, `bPValue=${r.bPValue}`);
  }
});

// ---------- dailyTokenBartlettCumulativePeriodogram ----------

test('dailyToken: rejects too-short series', () => {
  assert.throws(() => dailyTokenBartlettCumulativePeriodogram([1, 2, 3]));
});

test('dailyToken: rejects zero-variance series', () => {
  assert.throws(() =>
    dailyTokenBartlettCumulativePeriodogram([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]),
  );
});

test('dailyToken: rejects non-finite values', () => {
  assert.throws(() =>
    dailyTokenBartlettCumulativePeriodogram([1, 2, Number.NaN, 4, 5, 6, 7, 8]),
  );
});

test('dailyToken: pure sinusoid concentrates spectrum (bD large, bPValue small)', () => {
  // pure sinusoid at period 4 over 32 days
  const values: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    values.push(100 + 50 * Math.sin((2 * Math.PI * i) / 4));
  }
  const r = dailyTokenBartlettCumulativePeriodogram(values);
  assert.ok(r.bD > 0.3, `expected large bD, got ${r.bD}`);
  assert.ok(r.bPValue < 0.05, `expected significant pValue, got ${r.bPValue}`);
});

test('dailyToken: bLambda = sqrt(K-1) * bD identity', () => {
  const values: number[] = [];
  for (let i = 0; i < 20; i += 1) {
    values.push(10 + i * 0.5 + Math.sin(i));
  }
  const r = dailyTokenBartlettCumulativePeriodogram(values);
  const expected = Math.sqrt(r.nFreqBins - 1) * r.bD;
  assert.ok(Math.abs(r.bLambda - expected) < 1e-9);
});

// ---------- buildDailyTokenBartlettCumulativePeriodogram ----------

test('build: empty queue -> empty rows', () => {
  const r = buildDailyTokenBartlettCumulativePeriodogram([], {
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: drops below-min-tokens sources', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    lines.push(ql(dayIso(i), 'src1', 10));
  }
  const r = buildDailyTokenBartlettCumulativePeriodogram(lines, {
    minTokens: 1000,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: drops below-min-tenure sources', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    lines.push(ql(dayIso(i), 'src1', 10000));
  }
  const r = buildDailyTokenBartlettCumulativePeriodogram(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: produces row for sufficient source', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    const tt = 1000 + 500 * Math.sin((2 * Math.PI * i) / 7);
    lines.push(ql(dayIso(i), 'src1', tt));
  }
  const r = buildDailyTokenBartlettCumulativePeriodogram(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src1');
  assert.ok(row.bD > 0);
  assert.ok(row.bPValue >= 0 && row.bPValue <= 1);
  assert.equal(row.nTenureDays, 40);
});

test('build: rejects invalid sort', () => {
  assert.throws(() =>
    buildDailyTokenBartlettCumulativePeriodogram([], {
      sort: 'nonsense' as unknown as 'bD',
    }),
  );
});

test('build: rejects too-small minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenBartlettCumulativePeriodogram([], { minTenureDays: 4 }),
  );
});

test('build: source filter restricts rows', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    lines.push(ql(dayIso(i), 'src1', 1000 + i * 10));
    lines.push(ql(dayIso(i), 'src2', 2000 + i * 5));
  }
  const r = buildDailyTokenBartlettCumulativePeriodogram(lines, {
    source: 'src1',
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src1');
  assert.equal(r.droppedSourceFilter, 40);
});
