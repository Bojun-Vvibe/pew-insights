import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenSenAdichieAlignedRankTrend,
  buildDailyTokenSenAdichieAlignedRankTrend,
  midranksSenAdichie,
  standardNormalCdfSenAdichie,
  twoSidedNormalPSenAdichie,
} from '../src/dailytokensenadichiealignedranktrend.js';
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

// ---------- standardNormalCdfSenAdichie ----------

test('standardNormalCdfSenAdichie(0) === 0.5', () => {
  assert.ok(Math.abs(standardNormalCdfSenAdichie(0) - 0.5) < 1e-9);
});

test('standardNormalCdfSenAdichie symmetry: Phi(z) + Phi(-z) === 1', () => {
  for (const z of [0.1, 0.5, 1.0, 1.96, 2.5, 3.0]) {
    const sum =
      standardNormalCdfSenAdichie(z) + standardNormalCdfSenAdichie(-z);
    assert.ok(Math.abs(sum - 1) < 1e-6, `z=${z}`);
  }
});

test('standardNormalCdfSenAdichie(1.96) ~ 0.975', () => {
  assert.ok(Math.abs(standardNormalCdfSenAdichie(1.96) - 0.975) < 1e-3);
});

test('standardNormalCdfSenAdichie handles +/- infinity', () => {
  assert.equal(standardNormalCdfSenAdichie(Number.POSITIVE_INFINITY), 1);
  assert.equal(standardNormalCdfSenAdichie(Number.NEGATIVE_INFINITY), 0);
});

test('standardNormalCdfSenAdichie rejects NaN', () => {
  assert.throws(() => standardNormalCdfSenAdichie(Number.NaN));
});

// ---------- twoSidedNormalPSenAdichie ----------

test('twoSidedNormalPSenAdichie(0) === 1', () => {
  assert.ok(Math.abs(twoSidedNormalPSenAdichie(0) - 1) < 1e-6);
});

test('twoSidedNormalPSenAdichie(1.96) ~ 0.05', () => {
  assert.ok(Math.abs(twoSidedNormalPSenAdichie(1.96) - 0.05) < 1e-3);
});

test('twoSidedNormalPSenAdichie symmetric in sign', () => {
  for (const z of [0.5, 1.0, 1.5, 2.0, 2.58]) {
    assert.ok(
      Math.abs(
        twoSidedNormalPSenAdichie(z) - twoSidedNormalPSenAdichie(-z),
      ) < 1e-9,
    );
  }
});

test('twoSidedNormalPSenAdichie rejects non-finite', () => {
  assert.throws(() => twoSidedNormalPSenAdichie(Number.NaN));
  assert.throws(() => twoSidedNormalPSenAdichie(Number.POSITIVE_INFINITY));
});

// ---------- midranksSenAdichie ----------

test('midranksSenAdichie strictly increasing', () => {
  assert.deepEqual(midranksSenAdichie([10, 20, 30, 40]), [1, 2, 3, 4]);
});

test('midranksSenAdichie strictly decreasing', () => {
  assert.deepEqual(midranksSenAdichie([40, 30, 20, 10]), [4, 3, 2, 1]);
});

test('midranksSenAdichie ties get average rank', () => {
  // values: [5,5,5,5] -> all rank 2.5
  assert.deepEqual(midranksSenAdichie([5, 5, 5, 5]), [2.5, 2.5, 2.5, 2.5]);
});

test('midranksSenAdichie pair tie', () => {
  // values: [10,20,20,30] -> ranks [1, 2.5, 2.5, 4]
  assert.deepEqual(midranksSenAdichie([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
});

test('midranksSenAdichie sum equals n*(n+1)/2', () => {
  for (const arr of [
    [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
    [1, 1, 1, 2, 2, 3],
    [10, 20, 30, 40, 50, 60, 70],
  ]) {
    const r = midranksSenAdichie(arr);
    const s = r.reduce((a, b) => a + b, 0);
    const n = arr.length;
    assert.ok(Math.abs(s - (n * (n + 1)) / 2) < 1e-9, `arr=${arr}`);
  }
});

// ---------- dailyTokenSenAdichieAlignedRankTrend ----------

test('dailyTokenSenAdichieAlignedRankTrend rejects n<21', () => {
  assert.throws(() =>
    dailyTokenSenAdichieAlignedRankTrend(new Array(20).fill(1)),
  );
});

test('dailyTokenSenAdichieAlignedRankTrend rejects non-finite', () => {
  const arr = new Array(21).fill(1);
  arr[5] = Number.NaN;
  assert.throws(() => dailyTokenSenAdichieAlignedRankTrend(arr));
});

test('dailyTokenSenAdichieAlignedRankTrend rejects negative weight', () => {
  const arr = new Array(21).fill(1);
  arr[5] = -1;
  assert.throws(() => dailyTokenSenAdichieAlignedRankTrend(arr));
});

test('dailyTokenSenAdichieAlignedRankTrend rejects zero variance', () => {
  assert.throws(() =>
    dailyTokenSenAdichieAlignedRankTrend(new Array(21).fill(7)),
  );
});

test('strictly increasing series => saZ > 0, saRho > 0, saConcordantSeasons = saActiveSeasons', () => {
  const arr = Array.from({ length: 28 }, (_, i) => 100 + i);
  const r = dailyTokenSenAdichieAlignedRankTrend(arr);
  assert.ok(r.saZ > 0);
  assert.ok(r.saRho > 0.99); // each cohort strictly monotone
  assert.equal(r.saConcordantSeasons, r.saActiveSeasons);
  assert.equal(r.saActiveSeasons, 7);
  assert.ok(r.saPValue < 0.05);
});

test('strictly decreasing series => saZ < 0, saRho < 0', () => {
  const arr = Array.from({ length: 28 }, (_, i) => 1000 - i);
  const r = dailyTokenSenAdichieAlignedRankTrend(arr);
  assert.ok(r.saZ < 0);
  assert.ok(r.saRho < -0.99);
  assert.equal(r.saConcordantSeasons, 0);
  assert.ok(r.saPValue < 0.05);
});

test('time-reversal NEGATES saL and saZ but PRESERVES saVar and saPValue', () => {
  const arr = [
    100, 200, 50, 90, 300, 110, 400, 120, 250, 70, 80, 320, 140, 410, 130, 260,
    85, 95, 340, 160, 420, 150, 270, 90, 110, 360, 180, 430,
  ];
  const r1 = dailyTokenSenAdichieAlignedRankTrend(arr);
  const r2 = dailyTokenSenAdichieAlignedRankTrend([...arr].reverse());
  assert.ok(Math.abs(r1.saL + r2.saL) < 1e-9, `saL: ${r1.saL} vs ${r2.saL}`);
  assert.ok(Math.abs(r1.saZ + r2.saZ) < 1e-9);
  assert.ok(Math.abs(r1.saVar - r2.saVar) < 1e-9);
  assert.ok(Math.abs(r1.saPValue - r2.saPValue) < 1e-9);
});

test('per-cohort additive shift INVARIANCE', () => {
  const baseline = Array.from({ length: 28 }, (_, i) => 100 + (i * 7) / 3);
  const shifted = baseline.map((v, i) => v + (i % 7) * 1000);
  const r1 = dailyTokenSenAdichieAlignedRankTrend(baseline);
  const r2 = dailyTokenSenAdichieAlignedRankTrend(shifted);
  assert.ok(Math.abs(r1.saL - r2.saL) < 1e-6);
  assert.ok(Math.abs(r1.saZ - r2.saZ) < 1e-6);
  assert.ok(Math.abs(r1.saPValue - r2.saPValue) < 1e-6);
});

test('saRho in [-1, +1]', () => {
  const r = dailyTokenSenAdichieAlignedRankTrend(
    Array.from({ length: 35 }, (_, i) => Math.abs(Math.sin(i)) + 0.1),
  );
  assert.ok(r.saRho >= -1 && r.saRho <= 1);
});

// ---------- builder ----------

test('builder: empty queue yields empty sources', () => {
  const r = buildDailyTokenSenAdichieAlignedRankTrend([], {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('builder: drops below min-tenure-days', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) lines.push(ql(dayIso(i), 'a', 5000));
  const r = buildDailyTokenSenAdichieAlignedRankTrend(lines, {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('builder: produces a row for a healthy increasing source', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 28; i += 1) lines.push(ql(dayIso(i), 'src', 100 + i * 5));
  const r = buildDailyTokenSenAdichieAlignedRankTrend(lines, {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src');
  assert.ok(row.saZ > 0);
  assert.equal(row.saActiveSeasons, 7);
  assert.equal(row.saConcordantSeasons, 7);
});

test('builder: rejects bad min-tenure-days', () => {
  assert.throws(() =>
    buildDailyTokenSenAdichieAlignedRankTrend([], { minTenureDays: 5 }),
  );
});

test('builder: rejects bad sort', () => {
  assert.throws(() =>
    // @ts-expect-error invalid sort key
    buildDailyTokenSenAdichieAlignedRankTrend([], { sort: 'nonsense' }),
  );
});

test('builder: source filter drops non-matching rows', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 28; i += 1) {
    lines.push(ql(dayIso(i), 'a', 100 + i));
    lines.push(ql(dayIso(i), 'b', 200 + i * 2));
  }
  const r = buildDailyTokenSenAdichieAlignedRankTrend(lines, {
    source: 'a',
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});
