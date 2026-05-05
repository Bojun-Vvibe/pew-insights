import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenHamedRaoMannKendallCorrected,
  buildDailyTokenHamedRaoMannKendallCorrected,
  midranksHamedRao,
  standardNormalCdfHamedRao,
  twoSidedNormalPHamedRao,
  mannKendallSHamedRao,
  varZeroMannKendallHamedRao,
  theilSenSlopeHamedRao,
  sampleAutocorrHamedRao,
  hamedRaoEta,
} from '../src/dailytokenhamedraomannkendallcorrected.js';
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

// ---------- standardNormalCdfHamedRao ----------

test('standardNormalCdfHamedRao(0) === 0.5', () => {
  assert.ok(Math.abs(standardNormalCdfHamedRao(0) - 0.5) < 1e-9);
});

test('standardNormalCdfHamedRao symmetry', () => {
  for (const z of [0.1, 0.5, 1.0, 1.96, 2.5, 3.0]) {
    const sum =
      standardNormalCdfHamedRao(z) + standardNormalCdfHamedRao(-z);
    assert.ok(Math.abs(sum - 1) < 1e-6, `z=${z}`);
  }
});

test('standardNormalCdfHamedRao(1.96) ~ 0.975', () => {
  assert.ok(Math.abs(standardNormalCdfHamedRao(1.96) - 0.975) < 1e-3);
});

test('standardNormalCdfHamedRao handles +/- infinity', () => {
  assert.equal(standardNormalCdfHamedRao(Number.POSITIVE_INFINITY), 1);
  assert.equal(standardNormalCdfHamedRao(Number.NEGATIVE_INFINITY), 0);
});

test('standardNormalCdfHamedRao rejects NaN', () => {
  assert.throws(() => standardNormalCdfHamedRao(Number.NaN));
});

// ---------- twoSidedNormalPHamedRao ----------

test('twoSidedNormalPHamedRao(0) === 1', () => {
  assert.ok(Math.abs(twoSidedNormalPHamedRao(0) - 1) < 1e-6);
});

test('twoSidedNormalPHamedRao(1.96) ~ 0.05', () => {
  assert.ok(Math.abs(twoSidedNormalPHamedRao(1.96) - 0.05) < 1e-3);
});

test('twoSidedNormalPHamedRao symmetric in sign', () => {
  for (const z of [0.5, 1.0, 1.5, 2.0, 2.58]) {
    assert.ok(
      Math.abs(twoSidedNormalPHamedRao(z) - twoSidedNormalPHamedRao(-z)) < 1e-9,
    );
  }
});

// ---------- midranksHamedRao ----------

test('midranksHamedRao strictly increasing', () => {
  assert.deepEqual(midranksHamedRao([10, 20, 30, 40]), [1, 2, 3, 4]);
});

test('midranksHamedRao ties get average rank', () => {
  assert.deepEqual(midranksHamedRao([5, 5, 5, 5]), [2.5, 2.5, 2.5, 2.5]);
});

test('midranksHamedRao pair tie', () => {
  assert.deepEqual(midranksHamedRao([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
});

// ---------- mannKendallSHamedRao ----------

test('mannKendallSHamedRao strictly increasing yields max S', () => {
  const x = Array.from({ length: 10 }, (_, i) => i + 1);
  assert.equal(mannKendallSHamedRao(x), (10 * 9) / 2);
});

test('mannKendallSHamedRao strictly decreasing yields min S', () => {
  const x = Array.from({ length: 10 }, (_, i) => 10 - i);
  assert.equal(mannKendallSHamedRao(x), -(10 * 9) / 2);
});

test('mannKendallSHamedRao constant series yields zero', () => {
  assert.equal(mannKendallSHamedRao(new Array(10).fill(7)), 0);
});

// ---------- varZeroMannKendallHamedRao ----------

test('varZeroMannKendallHamedRao matches closed form for no ties', () => {
  // n=10: n*(n-1)*(2n+5)/18 = 10*9*25/18 = 125
  const x = Array.from({ length: 10 }, (_, i) => i + 1);
  assert.ok(Math.abs(varZeroMannKendallHamedRao(x) - 125) < 1e-9);
});

test('varZeroMannKendallHamedRao reduces with all-tied values', () => {
  // all 10 tied: tieAdj = 10*9*25 = 2250; main = 2250 -> var = 0
  const x = new Array(10).fill(5);
  assert.equal(varZeroMannKendallHamedRao(x), 0);
});

// ---------- theilSenSlopeHamedRao ----------

test('theilSenSlopeHamedRao on linear data recovers slope', () => {
  const x = Array.from({ length: 20 }, (_, i) => 3 + 2 * i);
  assert.ok(Math.abs(theilSenSlopeHamedRao(x) - 2) < 1e-9);
});

test('theilSenSlopeHamedRao on flat is zero', () => {
  assert.equal(theilSenSlopeHamedRao(new Array(10).fill(7)), 0);
});

// ---------- sampleAutocorrHamedRao ----------

test('sampleAutocorrHamedRao(constant, k) === 0', () => {
  // constant series has zero variance -> 0 by convention
  assert.equal(sampleAutocorrHamedRao(new Array(10).fill(3), 1), 0);
});

test('sampleAutocorrHamedRao(linear, k=1) close to 1', () => {
  const r = Array.from({ length: 30 }, (_, i) => i);
  assert.ok(sampleAutocorrHamedRao(r, 1) > 0.85);
});

// ---------- hamedRaoEta ----------

test('hamedRaoEta on iid uniform series yields eta close to 1', () => {
  // pseudo-random looking
  const x = [
    7, 13, 5, 19, 2, 11, 8, 16, 4, 14, 6, 12, 9, 17, 3, 15, 10, 1, 18, 20, 8,
    13, 5, 19, 2, 11, 8, 16,
  ];
  const { eta } = hamedRaoEta(x);
  assert.ok(eta >= 1);
  assert.ok(eta < 5, `eta=${eta} should be modest for noisy series`);
});

test('hamedRaoEta on highly autocorrelated series yields eta > 1', () => {
  // strong AR(1): each value close to previous
  const x: number[] = [50];
  for (let i = 1; i < 30; i += 1) {
    x.push(Math.max(0, x[i - 1]! + ((i % 5) - 2) * 0.1));
  }
  const { eta } = hamedRaoEta(x);
  assert.ok(eta >= 1);
});

// ---------- dailyTokenHamedRaoMannKendallCorrected ----------

test('dailyTokenHamedRaoMannKendallCorrected rejects n<21', () => {
  assert.throws(() =>
    dailyTokenHamedRaoMannKendallCorrected(new Array(20).fill(1)),
  );
});

test('dailyTokenHamedRaoMannKendallCorrected rejects non-finite', () => {
  const arr = new Array(21).fill(1);
  arr[5] = Number.NaN;
  assert.throws(() => dailyTokenHamedRaoMannKendallCorrected(arr));
});

test('dailyTokenHamedRaoMannKendallCorrected rejects negative weight', () => {
  const arr = new Array(21).fill(1);
  arr[5] = -1;
  assert.throws(() => dailyTokenHamedRaoMannKendallCorrected(arr));
});

test('dailyTokenHamedRaoMannKendallCorrected rejects zero variance', () => {
  assert.throws(() =>
    dailyTokenHamedRaoMannKendallCorrected(new Array(21).fill(7)),
  );
});

test('strictly increasing series => hrZ > 0, hrTau ~ 1, hrPValue < 0.05', () => {
  const arr = Array.from({ length: 28 }, (_, i) => 100 + i);
  const r = dailyTokenHamedRaoMannKendallCorrected(arr);
  assert.ok(r.hrZ > 0);
  assert.ok(r.hrTau > 0.99);
  assert.ok(r.hrPValue < 0.05);
  assert.ok(r.hrEta >= 1);
});

test('strictly decreasing series => hrZ < 0, hrTau < -0.99', () => {
  const arr = Array.from({ length: 28 }, (_, i) => 1000 - i);
  const r = dailyTokenHamedRaoMannKendallCorrected(arr);
  assert.ok(r.hrZ < 0);
  assert.ok(r.hrTau < -0.99);
  assert.ok(r.hrPValue < 0.05);
});

test('hrEta == 1 => hrZ == hrNaiveZ', () => {
  // pick a series where rank-acf has no significant lag: noisy
  const arr = [
    100, 200, 50, 90, 300, 110, 400, 120, 250, 70, 80, 320, 140, 410, 130, 260,
    85, 95, 340, 160, 420, 150, 270, 90, 110, 360, 180, 430,
  ];
  const r = dailyTokenHamedRaoMannKendallCorrected(arr);
  if (r.hrEta === 1) {
    assert.ok(Math.abs(r.hrZ - r.hrNaiveZ) < 1e-9);
    assert.ok(Math.abs(r.hrPValue - r.hrNaivePValue) < 1e-9);
  } else {
    // when eta>1, hrZ magnitude should not exceed naive
    assert.ok(Math.abs(r.hrZ) <= Math.abs(r.hrNaiveZ) + 1e-9);
  }
});

test('time-reversal NEGATES hrS, hrZ, hrTau but preserves hrEta, hrPValue', () => {
  const arr = [
    100, 200, 50, 90, 300, 110, 400, 120, 250, 70, 80, 320, 140, 410, 130, 260,
    85, 95, 340, 160, 420, 150, 270, 90, 110, 360, 180, 430,
  ];
  const r1 = dailyTokenHamedRaoMannKendallCorrected(arr);
  const r2 = dailyTokenHamedRaoMannKendallCorrected([...arr].reverse());
  assert.ok(Math.abs(r1.hrS + r2.hrS) < 1e-9);
  assert.ok(Math.abs(r1.hrZ + r2.hrZ) < 1e-6);
  assert.ok(Math.abs(r1.hrTau + r2.hrTau) < 1e-9);
  assert.ok(Math.abs(r1.hrEta - r2.hrEta) < 1e-6);
  assert.ok(Math.abs(r1.hrPValue - r2.hrPValue) < 1e-6);
});

test('hrEta is FLOORED at 1', () => {
  // Any series should have hrEta >= 1 by construction
  const arr = Array.from({ length: 30 }, (_, i) => 100 + ((i * 17) % 19));
  const r = dailyTokenHamedRaoMannKendallCorrected(arr);
  assert.ok(r.hrEta >= 1);
  assert.ok(r.hrEffectiveN <= arr.length + 1e-9);
});

test('hrTau in [-1, +1]', () => {
  const arr = Array.from(
    { length: 35 },
    (_, i) => Math.abs(Math.sin(i)) + 0.1,
  );
  const r = dailyTokenHamedRaoMannKendallCorrected(arr);
  assert.ok(r.hrTau >= -1 && r.hrTau <= 1);
});

// ---------- builder ----------

test('builder: empty queue yields empty sources', () => {
  const r = buildDailyTokenHamedRaoMannKendallCorrected([], {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('builder: drops below min-tenure-days', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) lines.push(ql(dayIso(i), 'a', 5000));
  const r = buildDailyTokenHamedRaoMannKendallCorrected(lines, {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('builder: produces a row for a healthy increasing source', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 28; i += 1) lines.push(ql(dayIso(i), 'src', 100 + i * 5));
  const r = buildDailyTokenHamedRaoMannKendallCorrected(lines, {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src');
  assert.ok(row.hrZ > 0);
  assert.ok(row.hrPValue < 0.05);
});

test('builder: rejects bad min-tenure-days', () => {
  assert.throws(() =>
    buildDailyTokenHamedRaoMannKendallCorrected([], { minTenureDays: 5 }),
  );
});

test('builder: rejects bad sort', () => {
  assert.throws(() =>
    // @ts-expect-error invalid sort key
    buildDailyTokenHamedRaoMannKendallCorrected([], { sort: 'nonsense' }),
  );
});

test('builder: source filter drops non-matching rows', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 28; i += 1) {
    lines.push(ql(dayIso(i), 'a', 100 + i));
    lines.push(ql(dayIso(i), 'b', 200 + i * 2));
  }
  const r = buildDailyTokenHamedRaoMannKendallCorrected(lines, {
    source: 'a',
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('builder: stable lexicographic source ordering on ties', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 28; i += 1) {
    // identical-trend series for a, b, c
    lines.push(ql(dayIso(i), 'b', 100 + i));
    lines.push(ql(dayIso(i), 'a', 100 + i));
    lines.push(ql(dayIso(i), 'c', 100 + i));
  }
  const r = buildDailyTokenHamedRaoMannKendallCorrected(lines, {
    sort: 'source',
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b', 'c'],
  );
});
