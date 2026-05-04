import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenVarghaDelaneyHalves,
  buildDailyTokenVarghaDelaneyHalves,
  varghaDelaneyStatistic,
  varghaDelaneyMagnitude,
  midRanksVd,
} from '../src/dailytokenvarghadelaneyhalves.js';
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

// ---------- midRanksVd ----------

test('vd: midRanksVd ascending sequence', () => {
  assert.deepEqual(midRanksVd([10, 20, 30]), [1, 2, 3]);
});

test('vd: midRanksVd descending sequence', () => {
  assert.deepEqual(midRanksVd([30, 20, 10]), [3, 2, 1]);
});

test('vd: midRanksVd ties get average rank', () => {
  assert.deepEqual(midRanksVd([5, 5, 10]), [1.5, 1.5, 3]);
});

test('vd: midRanksVd empty', () => {
  assert.deepEqual(midRanksVd([]), []);
});

test('vd: midRanksVd all equal', () => {
  assert.deepEqual(midRanksVd([7, 7, 7, 7]), [2.5, 2.5, 2.5, 2.5]);
});

// ---------- varghaDelaneyMagnitude ----------

test('vd: magnitude negligible just under .06', () => {
  assert.equal(varghaDelaneyMagnitude(0.55), 'negligible');
  assert.equal(varghaDelaneyMagnitude(0.45), 'negligible');
});

test('vd: magnitude small at .07 / .13', () => {
  assert.equal(varghaDelaneyMagnitude(0.57), 'small');
  assert.equal(varghaDelaneyMagnitude(0.63), 'small');
  assert.equal(varghaDelaneyMagnitude(0.37), 'small');
});

test('vd: magnitude medium at .15 / .20', () => {
  assert.equal(varghaDelaneyMagnitude(0.65), 'medium');
  assert.equal(varghaDelaneyMagnitude(0.70), 'medium');
});

test('vd: magnitude large at .22 / .30', () => {
  assert.equal(varghaDelaneyMagnitude(0.72), 'large');
  assert.equal(varghaDelaneyMagnitude(0.90), 'large');
  assert.equal(varghaDelaneyMagnitude(0.10), 'large');
});

test('vd: magnitude throws on non-finite', () => {
  assert.throws(() => varghaDelaneyMagnitude(NaN), /finite/);
  assert.throws(() => varghaDelaneyMagnitude(Infinity), /finite/);
});

// ---------- varghaDelaneyStatistic ----------

test('vd: identical samples -> A12 = 0.5', () => {
  // With pure ties, every (i,j) contributes 0.5 -> A12 = 0.5.
  const a = [1, 2, 3, 4, 5];
  const b = [1, 2, 3, 4, 5];
  const r = varghaDelaneyStatistic(a, b);
  assert.equal(r.vdA12, 0.5);
});

test('vd: full domination by sample B -> A12 = 1', () => {
  const a = [1, 2, 3, 4, 5];
  const b = [10, 20, 30, 40, 50];
  const r = varghaDelaneyStatistic(a, b);
  assert.equal(r.vdA12, 1);
});

test('vd: full domination by sample A -> A12 = 0', () => {
  const a = [10, 20, 30, 40, 50];
  const b = [1, 2, 3, 4, 5];
  const r = varghaDelaneyStatistic(a, b);
  assert.equal(r.vdA12, 0);
});

test('vd: half ties half wins', () => {
  // a = [1,2], b = [2,3]. Pairs: (1,2)>, (1,3)>, (2,2)tie, (2,3)>
  // wins = 3, ties = 1, n1*n2 = 4 -> A12 = (3 + 0.5)/4 = 0.875
  const r = varghaDelaneyStatistic([1, 2], [2, 3]);
  assert.equal(r.vdA12, 0.875);
});

test('vd: A12 == 1 - A12_swapped', () => {
  // Symmetry: swap arguments and A12 flips around 0.5.
  const a = [1, 3, 5, 7, 9];
  const b = [2, 4, 6, 8, 10];
  const r1 = varghaDelaneyStatistic(a, b);
  const r2 = varghaDelaneyStatistic(b, a);
  // Allow ties contribution to keep equality.
  assert.ok(Math.abs(r1.vdA12 + r2.vdA12 - 1) < 1e-12);
});

test('vd: SE is positive and CI brackets A12', () => {
  const r = varghaDelaneyStatistic(
    [1, 2, 3, 4, 5, 6, 7, 8],
    [3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.ok(r.vdSe > 0);
  assert.ok(r.vdCiLow <= r.vdA12);
  assert.ok(r.vdCiHigh >= r.vdA12);
});

test('vd: CI clamped to [0, 1]', () => {
  const r = varghaDelaneyStatistic(
    [1, 2, 3, 4, 5],
    [100, 200, 300, 400, 500],
  );
  assert.equal(r.vdA12, 1);
  assert.ok(r.vdCiHigh <= 1);
  assert.ok(r.vdCiLow >= 0);
});

test('vd: throws on too-small sample', () => {
  assert.throws(() => varghaDelaneyStatistic([1], [2, 3]), /at least 2/);
  assert.throws(() => varghaDelaneyStatistic([1, 2], [3]), /at least 2/);
});

test('vd: throws on non-finite', () => {
  assert.throws(() => varghaDelaneyStatistic([NaN, 2], [3, 4]), /finite/);
  assert.throws(() => varghaDelaneyStatistic([1, 2], [Infinity, 4]), /finite/);
});

// ---------- dailyTokenVarghaDelaneyHalves ----------

test('vd: dailyTokenVarghaDelaneyHalves splits at floor(n/2) and detects rise', () => {
  const v = [
    1000, 1010, 1020, 1030, 1040, 1050, 1060, 1070,
    50000, 50010, 50020, 50030, 50040, 50050, 50060, 50070,
  ];
  const r = dailyTokenVarghaDelaneyHalves(v);
  assert.equal(r.vdN1, 8);
  assert.equal(r.vdN2, 8);
  assert.equal(r.vdA12, 1);
});

test('vd: dailyTokenVarghaDelaneyHalves odd n splits floor', () => {
  const v = Array.from({ length: 17 }, (_, i) => i + 1);
  const r = dailyTokenVarghaDelaneyHalves(v);
  assert.equal(r.vdN1, 8);
  assert.equal(r.vdN2, 9);
});

test('vd: dailyTokenVarghaDelaneyHalves throws below 16', () => {
  assert.throws(() => dailyTokenVarghaDelaneyHalves(new Array(15).fill(0).map((_, i) => i + 1)), /at least 16/);
});

test('vd: dailyTokenVarghaDelaneyHalves throws on zero variance', () => {
  assert.throws(() => dailyTokenVarghaDelaneyHalves(new Array(16).fill(42)), /zero centred variance/);
});

test('vd: dailyTokenVarghaDelaneyHalves throws on non-finite', () => {
  const v = Array.from({ length: 16 }, (_, i) => (i === 0 ? NaN : i));
  assert.throws(() => dailyTokenVarghaDelaneyHalves(v), /finite/);
});

// ---------- buildDailyTokenVarghaDelaneyHalves ----------

test('vd: build end-to-end happy path with strong rise', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    const t = i < 10 ? 1000 + i : 50_000 + i;
    queue.push(ql(dayIso(i), 'src-A', t));
  }
  const r = buildDailyTokenVarghaDelaneyHalves(queue);
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.vdA12, 1);
  assert.equal(row.vdSign, 1);
  assert.equal(row.vdMagnitude, 'large');
  assert.ok(row.vdCiExcludesHalf);
});

test('vd: build with strong fall reports A12 < 0.5 / sign -1', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    const t = i < 10 ? 50_000 + i : 1000 + i;
    queue.push(ql(dayIso(i), 'falling', t));
  }
  const r = buildDailyTokenVarghaDelaneyHalves(queue);
  assert.equal(r.sources[0]!.vdA12, 0);
  assert.equal(r.sources[0]!.vdSign, -1);
  assert.equal(r.sources[0]!.vdMagnitude, 'large');
});

test('vd: build drops sparse sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'tiny', 5));
  const r = buildDailyTokenVarghaDelaneyHalves(queue, { minTokens: 1000 });
  assert.equal(r.droppedSparseSources, 1);
});

test('vd: build drops short tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) queue.push(ql(dayIso(i), 'short', 5_000));
  const r = buildDailyTokenVarghaDelaneyHalves(queue);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('vd: build drops zero variance', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'flat', 1_000));
  const r = buildDailyTokenVarghaDelaneyHalves(queue);
  assert.equal(r.droppedZeroVariance, 1);
});

test('vd: build drops invalid hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src', 1000),
    ql(dayIso(0), 'src', 1000),
  ];
  const r = buildDailyTokenVarghaDelaneyHalves(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('vd: build drops non-positive tokens', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'src', 0),
    ql(dayIso(1), 'src', -3),
    ql(dayIso(2), 'src', 100),
  ];
  const r = buildDailyTokenVarghaDelaneyHalves(queue);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('vd: build source filter works', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'A', 5_000));
    queue.push(ql(dayIso(i), 'B', 5_000));
  }
  const r = buildDailyTokenVarghaDelaneyHalves(queue, { source: 'A' });
  assert.equal(r.droppedSourceFilter, 20);
});

test('vd: build top cap', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      const t = i < 10 ? 1000 * (s + 1) + i : 10_000 * (s + 1) + i;
      queue.push(ql(dayIso(i), `src-${s}`, t));
    }
  }
  const r = buildDailyTokenVarghaDelaneyHalves(queue, { top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('vd: build sorts by a12 ascending', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    // strong rise -> A12 high
    queue.push(ql(dayIso(i), 'rise', i < 10 ? 1000 + i : 50_000 + i));
    // strong fall -> A12 low
    queue.push(ql(dayIso(i), 'fall', i < 10 ? 50_000 + i : 1000 + i));
  }
  const r = buildDailyTokenVarghaDelaneyHalves(queue, { sort: 'a12' });
  assert.equal(r.sources[0]!.source, 'fall');
  assert.equal(r.sources[1]!.source, 'rise');
});

test('vd: build invalid sort throws', () => {
  assert.throws(
    () => buildDailyTokenVarghaDelaneyHalves([], { sort: 'nope' as never }),
    /sort must be one of/,
  );
});

test('vd: build invalid minTokens throws', () => {
  assert.throws(
    () => buildDailyTokenVarghaDelaneyHalves([], { minTokens: -1 }),
    /minTokens/,
  );
});

test('vd: build invalid minTenureDays throws', () => {
  assert.throws(
    () => buildDailyTokenVarghaDelaneyHalves([], { minTenureDays: 8 }),
    /minTenureDays/,
  );
});

test('vd: build invalid top throws', () => {
  assert.throws(
    () => buildDailyTokenVarghaDelaneyHalves([], { top: -1 }),
    /top/,
  );
});

test('vd: build A12 is in [0, 1] always', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'mixed', Math.floor(Math.sin(i) * 1000) + 5_000));
  }
  const r = buildDailyTokenVarghaDelaneyHalves(queue);
  for (const row of r.sources) {
    assert.ok(row.vdA12 >= 0 && row.vdA12 <= 1);
    assert.ok(row.vdCiLow >= 0 && row.vdCiLow <= 1);
    assert.ok(row.vdCiHigh >= 0 && row.vdCiHigh <= 1);
  }
});
