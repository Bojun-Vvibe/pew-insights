import test from 'node:test';
import assert from 'node:assert/strict';
import {
  kuiperVSurvival,
  kuiperVCumulativePeriodogramStatistic,
  dailyTokenKuiperVCumulativePeriodogram,
  buildDailyTokenKuiperVCumulativePeriodogram,
} from '../src/dailytokenkuipervcumulativeperiodogram.js';
import { bartlettCumulativePeriodogramStatistic } from '../src/dailytokenbartlettcumulativeperiodogram.js';
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

// ---------- kuiperVSurvival ----------

test('kuiperVSurvival: v <= 0 -> p = 1', () => {
  assert.equal(kuiperVSurvival(0), 1);
  assert.equal(kuiperVSurvival(-1), 1);
});

test('kuiperVSurvival: very large v -> p ~ 0', () => {
  assert.ok(kuiperVSurvival(10) < 1e-30);
});

test('kuiperVSurvival: published critical values within tolerance', () => {
  // Stephens (1970) JRSS-B 32(1):115-122 Table 1, critical
  // values for kpVStar:
  //   P(V* > 1.620) = 0.10
  //   P(V* > 1.747) = 0.05
  //   P(V* > 1.862) = 0.025
  //   P(V* > 2.001) = 0.01
  // Asymptotic series tolerance ~5e-3.
  assert.ok(
    Math.abs(kuiperVSurvival(1.620) - 0.10) < 5e-3,
    `at 1.620 got ${kuiperVSurvival(1.620)}`,
  );
  assert.ok(
    Math.abs(kuiperVSurvival(1.747) - 0.05) < 5e-3,
    `at 1.747 got ${kuiperVSurvival(1.747)}`,
  );
  assert.ok(
    Math.abs(kuiperVSurvival(1.862) - 0.025) < 5e-3,
    `at 1.862 got ${kuiperVSurvival(1.862)}`,
  );
  assert.ok(
    Math.abs(kuiperVSurvival(2.001) - 0.01) < 5e-3,
    `at 2.001 got ${kuiperVSurvival(2.001)}`,
  );
});

test('kuiperVSurvival: result in [0, 1]', () => {
  for (let v = 0; v < 8; v += 0.1) {
    const p = kuiperVSurvival(v);
    assert.ok(p >= 0 && p <= 1, `v=${v} -> p=${p} out of [0,1]`);
  }
});

test('kuiperVSurvival: monotone non-increasing in v for v >= 0.5', () => {
  let prev = Infinity;
  for (let v = 0.5; v < 6; v += 0.05) {
    const p = kuiperVSurvival(v);
    assert.ok(p <= prev + 1e-9, `non-monotone at v=${v}: ${p} > ${prev}`);
    prev = p;
  }
});

test('kuiperVSurvival: rejects non-finite input', () => {
  assert.throws(() => kuiperVSurvival(Number.NaN));
  assert.throws(() => kuiperVSurvival(Infinity));
});

// ---------- kuiperVCumulativePeriodogramStatistic ----------

test('kuiperVCPMStatistic: flat power -> kpV = 0, kpPValue ~ 1', () => {
  const power = new Array(10).fill(1);
  const r = kuiperVCumulativePeriodogramStatistic(power);
  assert.ok(r.kpV < 1e-12, `flat kpV=${r.kpV} > 0`);
  assert.equal(r.kpVStar, 0);
  assert.equal(r.kpPValue, 1);
  assert.equal(r.totalPower, 10);
});

test('kuiperVCPMStatistic: spike at j=1 -> kpDPlus = 1 - 1/K, kpDMinus = 0', () => {
  const K = 8;
  const power = [1, 0, 0, 0, 0, 0, 0, 0];
  const r = kuiperVCumulativePeriodogramStatistic(power);
  assert.ok(
    Math.abs(r.kpDPlus - (1 - 1 / K)) < 1e-12,
    `kpDPlus=${r.kpDPlus} expected ${1 - 1 / K}`,
  );
  assert.ok(r.kpDMinus < 1e-12, `kpDMinus=${r.kpDMinus} expected 0`);
  assert.equal(r.kpJPlus, 1);
});

test('kuiperVCPMStatistic: spike at j=K -> kpDMinus = (K-1)/K, kpDPlus = 0', () => {
  const K = 8;
  const power = [0, 0, 0, 0, 0, 0, 0, 1];
  const r = kuiperVCumulativePeriodogramStatistic(power);
  assert.ok(r.kpDPlus < 1e-12, `kpDPlus=${r.kpDPlus} expected 0`);
  assert.ok(
    Math.abs(r.kpDMinus - (K - 1) / K) < 1e-12,
    `kpDMinus=${r.kpDMinus} expected ${(K - 1) / K}`,
  );
  assert.equal(r.kpJMinus, K - 1);
});

test('kuiperVCPMStatistic: bin-reversal symmetry (kpDPlus, kpDMinus) swap', () => {
  const power = [3, 1, 2, 5, 1, 4, 2, 1];
  const reversed = power.slice().reverse();
  const r1 = kuiperVCumulativePeriodogramStatistic(power);
  const r2 = kuiperVCumulativePeriodogramStatistic(reversed);
  assert.ok(
    Math.abs(r1.kpV - r2.kpV) < 1e-12,
    `bin-reversal kpV mismatch: ${r1.kpV} vs ${r2.kpV}`,
  );
  assert.ok(Math.abs(r1.kpDPlus - r2.kpDMinus) < 1e-12);
  assert.ok(Math.abs(r1.kpDMinus - r2.kpDPlus) < 1e-12);
});

test('kuiperVCPMStatistic: kpV >= bartlett bD (Kuiper >= sup-norm)', () => {
  // Kuiper V = D+ + D- always dominates the sup-norm
  // bD = max(D+, D-) since both are non-negative.
  const cases = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [5, 1, 1, 1, 5, 1, 1, 5],
    [10, 1, 2, 8, 1, 9, 1, 2],
  ];
  for (const power of cases) {
    const k = kuiperVCumulativePeriodogramStatistic(power);
    const b = bartlettCumulativePeriodogramStatistic(power);
    assert.ok(
      k.kpV >= b.bD - 1e-12,
      `kpV=${k.kpV} should be >= bD=${b.bD} for ${JSON.stringify(power)}`,
    );
    assert.ok(
      k.kpV <= 2 * b.bD + 1e-12,
      `kpV=${k.kpV} should be <= 2*bD=${2 * b.bD}`,
    );
  }
});

test('kuiperVCPMStatistic: rejects too-few bins / non-finite / negative / zero-total', () => {
  assert.throws(() => kuiperVCumulativePeriodogramStatistic([1]));
  assert.throws(() => kuiperVCumulativePeriodogramStatistic([1, NaN, 1, 1]));
  assert.throws(() => kuiperVCumulativePeriodogramStatistic([1, -1, 1, 1]));
  assert.throws(() => kuiperVCumulativePeriodogramStatistic([0, 0, 0, 0]));
});

// ---------- dailyTokenKuiperVCumulativePeriodogram ----------

test('dailyTokenKuiperVCPM: shift-invariance', () => {
  const series = [3, 5, 2, 8, 4, 7, 1, 9, 5, 3, 6, 4, 8, 2, 5, 7];
  const a = dailyTokenKuiperVCumulativePeriodogram(series);
  const b = dailyTokenKuiperVCumulativePeriodogram(series.map((x) => x + 100));
  assert.ok(Math.abs(a.kpV - b.kpV) < 1e-9);
  assert.ok(Math.abs(a.kpVStar - b.kpVStar) < 1e-9);
});

test('dailyTokenKuiperVCPM: scale-invariance', () => {
  const series = [3, 5, 2, 8, 4, 7, 1, 9, 5, 3, 6, 4, 8, 2, 5, 7];
  const a = dailyTokenKuiperVCumulativePeriodogram(series);
  const b = dailyTokenKuiperVCumulativePeriodogram(series.map((x) => x * 7.3));
  assert.ok(Math.abs(a.kpV - b.kpV) < 1e-9);
});

test('dailyTokenKuiperVCPM: rejects too-short / non-finite / constant', () => {
  assert.throws(() => dailyTokenKuiperVCumulativePeriodogram([1, 2, 3]));
  assert.throws(() =>
    dailyTokenKuiperVCumulativePeriodogram([1, 2, 3, 4, 5, 6, NaN, 8]),
  );
  assert.throws(() =>
    dailyTokenKuiperVCumulativePeriodogram([5, 5, 5, 5, 5, 5, 5, 5]),
  );
});

// ---------- buildDailyTokenKuiperVCumulativePeriodogram ----------

test('buildDailyTokenKuiperVCPM: empty queue -> zero rows', () => {
  const r = buildDailyTokenKuiperVCumulativePeriodogram([], {
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('buildDailyTokenKuiperVCPM: single-source flow with min-tenure-days', () => {
  const queue: QueueLine[] = [];
  const tokens = [
    1000, 2000, 1500, 3000, 800, 2500, 1200, 1800, 2100, 1700, 900, 2400, 1300,
    2700, 1100, 1900, 2200, 1600, 950, 2300, 1400, 2800, 1050, 1850, 2150,
    1750, 1250, 2450, 1350, 2650, 1150, 1950,
  ];
  for (let i = 0; i < tokens.length; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', tokens[i]!));
  }
  const r = buildDailyTokenKuiperVCumulativePeriodogram(queue, {
    minTenureDays: 16,
    minTokens: 100,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'srcA');
  assert.equal(row.nTenureDays, tokens.length);
  assert.ok(row.kpV >= 0 && row.kpV <= 1);
  assert.ok(row.kpVStar >= 0);
  assert.ok(row.kpPValue >= 0 && row.kpPValue <= 1);
  assert.ok(Number.isInteger(row.kpJPlus) || row.kpJPlus === 0);
  assert.ok(Number.isInteger(row.kpJMinus) || row.kpJMinus === 0);
});

test('buildDailyTokenKuiperVCPM: dropped-counters surface correctly', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'srcA', 100),
    ql(dayIso(0), 'srcA', 0),
    ql(dayIso(0), 'srcB', 50),
  ];
  // srcB has only 50 tokens (below min-tokens 1000) and one
  // day (below tenure 16).
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'srcShort', 5000));
  }
  const r = buildDailyTokenKuiperVCumulativePeriodogram(queue, {
    minTenureDays: 16,
    minTokens: 1000,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.ok(r.droppedInvalidHourStart >= 1);
  assert.ok(r.droppedNonPositiveTokens >= 1);
  assert.ok(r.droppedSparseSources + r.droppedBelowMinTenure >= 1);
});

test('buildDailyTokenKuiperVCPM: invalid sort throws', () => {
  assert.throws(() =>
    buildDailyTokenKuiperVCumulativePeriodogram([], {
      sort: 'bogus' as never,
    }),
  );
});

// ---------- aggregateKuiperVCumulativePeriodogram ----------

import {
  aggregateKuiperVCumulativePeriodogram,
  chiSquaredUpperTailLocal,
} from '../src/dailytokenkuipervcumulativeperiodogram.js';

test('aggregateKuiperVCPM: empty input -> rowsUsed=0, fisher=1, ratio=0', () => {
  const a = aggregateKuiperVCumulativePeriodogram([]);
  assert.equal(a.rowsUsed, 0);
  assert.equal(a.rowsSkipped, 0);
  assert.equal(a.fisherCombinedPValue, 1);
  assert.equal(a.twoSidedAsymmetryRatio, 0);
});

test('aggregateKuiperVCPM: skips malformed rows with counter', () => {
  const a = aggregateKuiperVCumulativePeriodogram([
    { nTenureDays: 30, kpVStar: 1.5, kpPValue: 0.2, kpDPlus: 0.1, kpDMinus: 0.05 },
    { nTenureDays: 1, kpVStar: 1.0, kpPValue: 0.5, kpDPlus: 0.05, kpDMinus: 0.0 }, // n<2
    { nTenureDays: 30, kpVStar: NaN, kpPValue: 0.5, kpDPlus: 0.05, kpDMinus: 0.0 },
    { nTenureDays: 30.5 as never, kpVStar: 1, kpPValue: 0.5, kpDPlus: 0.05, kpDMinus: 0.0 },
    { nTenureDays: 30, kpVStar: 1, kpPValue: 0.5, kpDPlus: -1, kpDMinus: 0.0 },
  ]);
  assert.equal(a.rowsUsed, 1);
  assert.equal(a.rowsSkipped, 4);
});

test('aggregateKuiperVCPM: uniformly one-sided rows -> ratio = 0', () => {
  const a = aggregateKuiperVCumulativePeriodogram([
    { nTenureDays: 30, kpVStar: 1.5, kpPValue: 0.2, kpDPlus: 0.2, kpDMinus: 0 },
    { nTenureDays: 50, kpVStar: 1.7, kpPValue: 0.05, kpDPlus: 0.3, kpDMinus: 0 },
    { nTenureDays: 40, kpVStar: 1.4, kpPValue: 0.3, kpDPlus: 0.15, kpDMinus: 0 },
  ]);
  assert.equal(a.rowsUsed, 3);
  assert.equal(a.twoSidedAsymmetryRatio, 0);
  assert.equal(a.sumKpDMinus, 0);
  assert.ok(Math.abs(a.sumKpDPlus - 0.65) < 1e-12);
});

test('aggregateKuiperVCPM: balanced two-sided -> ratio near 1', () => {
  const a = aggregateKuiperVCumulativePeriodogram([
    { nTenureDays: 30, kpVStar: 2.0, kpPValue: 0.01, kpDPlus: 0.2, kpDMinus: 0.2 },
    { nTenureDays: 30, kpVStar: 2.0, kpPValue: 0.01, kpDPlus: 0.15, kpDMinus: 0.18 },
  ]);
  assert.ok(a.twoSidedAsymmetryRatio > 0.9);
  assert.ok(a.fisherCombinedPValue < 0.01);
});

test('aggregateKuiperVCPM: tenure-weighting honoured', () => {
  // Big-tenure source dominates the weighted average.
  const a = aggregateKuiperVCumulativePeriodogram([
    { nTenureDays: 4, kpVStar: 0.5, kpPValue: 0.9, kpDPlus: 0.05, kpDMinus: 0.05 },
    { nTenureDays: 1000, kpVStar: 3.0, kpPValue: 1e-6, kpDPlus: 0.4, kpDMinus: 0.3 },
  ]);
  assert.ok(
    Math.abs(a.tenureWeightedKpVStar - 3.0) < 0.05,
    `weighted mean ${a.tenureWeightedKpVStar} should be near 3.0`,
  );
});

test('chiSquaredUpperTailLocal: known anchors', () => {
  // P(Chi^2_2 > 0) = 1
  assert.equal(chiSquaredUpperTailLocal(0, 2), 1);
  // P(Chi^2_2 > 5.991) ~ 0.05 (5% critical value, k=2)
  assert.ok(Math.abs(chiSquaredUpperTailLocal(5.991, 2) - 0.05) < 1e-3);
  // P(Chi^2_4 > 9.488) ~ 0.05 (5% critical value, k=4)
  assert.ok(Math.abs(chiSquaredUpperTailLocal(9.488, 4) - 0.05) < 1e-3);
  // Very large x -> 0
  assert.ok(chiSquaredUpperTailLocal(200, 2) < 1e-30);
});
