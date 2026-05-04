import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenSavageHalves,
  buildDailyTokenSavageHalves,
  savageScores,
  midrank,
  standardNormalUpperTailSavage,
  labelSavageHalvesRow,
} from '../src/dailytokensavagehalves.js';
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

// ---------- primitive: savageScores ----------

test('sav: savageScores throws on n < 2', () => {
  assert.throws(() => savageScores(1));
  assert.throws(() => savageScores(0));
  assert.throws(() => savageScores(1.5));
});

test('sav: savageScores(N) sums to 0 within fp tolerance', () => {
  for (const n of [2, 5, 16, 50, 100, 500]) {
    const s = savageScores(n);
    let sum = 0;
    for (const v of s) sum += v;
    // Tolerance scales with N due to harmonic-sum accumulation.
    assert.ok(Math.abs(sum) < n * 1e-14, `n=${n} sum=${sum}`);
  }
});

test('sav: savageScores monotone strictly increasing', () => {
  const s = savageScores(20);
  for (let i = 1; i < s.length; i += 1) {
    assert.ok(s[i]! > s[i - 1]!, `not monotone at i=${i}`);
  }
});

test('sav: savageScores(2) = [-0.5, 0.5]', () => {
  const s = savageScores(2);
  // a(1) = 1/2 - 1 = -0.5; a(2) = 1/2 + 1 - 1 = 0.5.
  assert.ok(Math.abs(s[0]! + 0.5) < 1e-12);
  assert.ok(Math.abs(s[1]! - 0.5) < 1e-12);
});

test('sav: savageScores(3) matches harmonic formula', () => {
  const s = savageScores(3);
  // H_3 = 1 + 1/2 + 1/3 = 11/6
  // a(1) = 1/3 - 1 = -2/3
  // a(2) = 1/3 + 1/2 - 1 = -1/6
  // a(3) = 11/6 - 1 = 5/6
  assert.ok(Math.abs(s[0]! - (-2 / 3)) < 1e-12);
  assert.ok(Math.abs(s[1]! - (-1 / 6)) < 1e-12);
  assert.ok(Math.abs(s[2]! - 5 / 6) < 1e-12);
});

// ---------- primitive: standardNormalUpperTailSavage ----------

test('sav: Q(0) === 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailSavage(0) - 0.5) < 1e-7);
});

test('sav: Q(1.96) ~ 0.025', () => {
  const q = standardNormalUpperTailSavage(1.96);
  assert.ok(Math.abs(q - 0.025) < 1e-3, `got ${q}`);
});

test('sav: Q(-z) === 1 - Q(z)', () => {
  for (const z of [0.5, 1.0, 2.5, 4.0]) {
    assert.ok(
      Math.abs(
        standardNormalUpperTailSavage(-z) +
          standardNormalUpperTailSavage(z) -
          1,
      ) < 1e-9,
    );
  }
});

test('sav: Q throws on non-finite', () => {
  assert.throws(() => standardNormalUpperTailSavage(Number.NaN));
  assert.throws(() => standardNormalUpperTailSavage(Number.POSITIVE_INFINITY));
});

// ---------- primitive: midrank ----------

test('sav: midrank of strict increasing == 1..n', () => {
  const r = midrank([10, 20, 30, 40]);
  assert.deepEqual(r, [1, 2, 3, 4]);
});

test('sav: midrank averages ties', () => {
  // values [1, 2, 2, 3] -> sorted positions 1, {2,3}, 4
  // tie at positions 2,3 -> midrank 2.5
  const r = midrank([1, 2, 2, 3]);
  assert.deepEqual(r, [1, 2.5, 2.5, 4]);
});

test('sav: midrank rank sum invariant N(N+1)/2', () => {
  for (const arr of [
    [5, 5, 5, 5],
    [1, 2, 2, 2, 3],
    [9, 1, 1, 9, 5, 5],
  ]) {
    const r = midrank(arr);
    let sum = 0;
    for (const v of r) sum += v;
    assert.ok(Math.abs(sum - (arr.length * (arr.length + 1)) / 2) < 1e-12);
  }
});

// ---------- core: dailyTokenSavageHalves ----------

test('sav: throws on n < 16', () => {
  assert.throws(() => dailyTokenSavageHalves([1, 2, 3]));
  assert.throws(() =>
    dailyTokenSavageHalves(Array.from({ length: 15 }, (_, i) => i + 1)),
  );
});

test('sav: throws on non-finite', () => {
  const arr = Array.from({ length: 16 }, (_, i) => i);
  arr[3] = Number.NaN;
  assert.throws(() => dailyTokenSavageHalves(arr));
});

test('sav: throws on zero variance (all equal)', () => {
  const arr = new Array(16).fill(7);
  assert.throws(() => dailyTokenSavageHalves(arr));
});

test('sav: monotone increasing => savZ > 0', () => {
  const arr = Array.from({ length: 16 }, (_, i) => i + 1);
  const r = dailyTokenSavageHalves(arr);
  assert.ok(r.savZ > 0, `expected positive savZ, got ${r.savZ}`);
  assert.ok(r.savPValue < 0.05, `expected significant, got p=${r.savPValue}`);
});

test('sav: monotone decreasing => savZ < 0', () => {
  const arr = Array.from({ length: 16 }, (_, i) => 16 - i);
  const r = dailyTokenSavageHalves(arr);
  assert.ok(r.savZ < 0, `expected negative savZ, got ${r.savZ}`);
});

test('sav: invariant under positive constant shift', () => {
  const base = [
    1, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10, 13, 12, 15, 14, 16, 18, 17,
  ];
  const a = dailyTokenSavageHalves(base);
  const b = dailyTokenSavageHalves(base.map((v) => v + 1000));
  assert.ok(Math.abs(a.savZ - b.savZ) < 1e-12);
  assert.ok(Math.abs(a.savPValue - b.savPValue) < 1e-12);
});

test('sav: invariant under positive scaling', () => {
  const base = [
    1, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10, 13, 12, 15, 14, 16, 18, 17,
  ];
  const a = dailyTokenSavageHalves(base);
  const b = dailyTokenSavageHalves(base.map((v) => v * 7.5));
  assert.ok(Math.abs(a.savZ - b.savZ) < 1e-12);
});

test('sav: reverse(x) flips sign exactly when n1 = n2', () => {
  const base = Array.from({ length: 16 }, (_, i) => Math.sin(i) + 2 * i);
  const a = dailyTokenSavageHalves(base);
  const b = dailyTokenSavageHalves([...base].reverse());
  assert.ok(Math.abs(a.savZ + b.savZ) < 1e-10, `${a.savZ} vs ${b.savZ}`);
});

test('sav: Var matches (n1 n2 / (N (N-1))) * sum a^2 exactly', () => {
  const base = Array.from({ length: 20 }, (_, i) => i * i + 1);
  const r = dailyTokenSavageHalves(base);
  const expected =
    ((r.savN1 * r.savN2) / (20 * 19)) * r.savSumScoreSquared;
  assert.ok(Math.abs(r.savVariance - expected) < 1e-12);
});

test('sav: small-sample n=16 result is finite & reasonable', () => {
  const base = [
    100, 200, 150, 180, 220, 160, 210, 190, 1000, 1100, 950, 1050, 980, 1080,
    1020, 990,
  ];
  const r = dailyTokenSavageHalves(base);
  assert.ok(Number.isFinite(r.savZ));
  assert.ok(r.savPValue > 0 && r.savPValue <= 1);
  assert.ok(r.savZ > 0); // second half is much larger
  assert.ok(r.savPValue < 0.01);
});

// ---------- builder: buildDailyTokenSavageHalves ----------

test('sav: builder rejects bad min-tenure-days < 16', () => {
  assert.throws(() =>
    buildDailyTokenSavageHalves([], { minTenureDays: 10 }),
  );
});

test('sav: builder rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenSavageHalves([], {
      sort: 'bogus' as never,
    }),
  );
});

test('sav: builder rejects negative top', () => {
  assert.throws(() =>
    buildDailyTokenSavageHalves([], { top: -1 as never }),
  );
});

test('sav: builder produces expected report shape', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 100 + i * 50));
  }
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src-b', 1000 - i * 30));
  }
  const r = buildDailyTokenSavageHalves(queue, {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 2);
  const a = r.sources.find((s) => s.source === 'src-a')!;
  const b = r.sources.find((s) => s.source === 'src-b')!;
  assert.ok(a.savZ > 0); // increasing
  assert.ok(b.savZ < 0); // decreasing
});

test('sav: builder drops sparse sources below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'tiny', 1));
  }
  const r = buildDailyTokenSavageHalves(queue);
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('sav: builder drops below min-tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'short', 5000));
  }
  const r = buildDailyTokenSavageHalves(queue);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('sav: builder source filter routes correctly', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'a', 100 + i * 100));
    queue.push(ql(dayIso(i), 'b', 100 + i * 100));
  }
  const r = buildDailyTokenSavageHalves(queue, { source: 'a' });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('sav: builder drops bad hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src', 100),
    ql(dayIso(0), 'src', 100),
  ];
  const r = buildDailyTokenSavageHalves(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('sav: builder respects top cap and droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), src, 100 + i * 50));
    }
  }
  const r = buildDailyTokenSavageHalves(queue, { top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('sav: sort=savZ ascending', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'inc', 100 + i * 50));
    queue.push(ql(dayIso(i), 'dec', 1000 - i * 30));
  }
  const r = buildDailyTokenSavageHalves(queue, { sort: 'savZ' });
  assert.ok(r.sources[0]!.savZ <= r.sources[1]!.savZ);
});

// ---------- labeller ----------

test('sav: label decisive second-larger', () => {
  assert.equal(
    labelSavageHalvesRow({ savZ: 3.5, savPValue: 0.001 }),
    'second-decisively-stochastically-larger',
  );
});

test('sav: label decisive first-larger', () => {
  assert.equal(
    labelSavageHalvesRow({ savZ: -3.5, savPValue: 0.001 }),
    'first-decisively-stochastically-larger',
  );
});

test('sav: label leans (alpha <= p < 2 alpha)', () => {
  assert.equal(
    labelSavageHalvesRow({ savZ: 1.7, savPValue: 0.07 }),
    'second-leans-stochastically-larger',
  );
  assert.equal(
    labelSavageHalvesRow({ savZ: -1.7, savPValue: 0.07 }),
    'first-leans-stochastically-larger',
  );
});

test('sav: label no-evidence at p >= 2 alpha', () => {
  assert.equal(
    labelSavageHalvesRow({ savZ: 0.5, savPValue: 0.5 }),
    'no-evidence-of-savage-shift',
  );
});

test('sav: label rejects bad inputs', () => {
  assert.throws(() => labelSavageHalvesRow({ savZ: Number.NaN, savPValue: 0.5 }));
  assert.throws(() => labelSavageHalvesRow({ savZ: 1, savPValue: 1.5 }));
  assert.throws(() => labelSavageHalvesRow({ savZ: 1, savPValue: 0.5 }, 0));
  assert.throws(() => labelSavageHalvesRow({ savZ: 1, savPValue: 0.5 }, 0.6));
});

// ---------- aggregator: aggregateSavageHalves ----------

import {
  aggregateSavageHalves,
  inverseStandardNormalCdfSavage,
} from '../src/dailytokensavagehalves.js';

test('sav: inverseStandardNormalCdf round-trip ~ identity', () => {
  for (const z of [-2.5, -1.0, 0.5, 1.96, 3.0]) {
    const upper = standardNormalUpperTailSavage(z);
    const back = inverseStandardNormalCdfSavage(1 - upper);
    assert.ok(Math.abs(back - z) < 1e-3, `z=${z} round=${back}`);
  }
});

test('sav: inverseStandardNormalCdf throws on out of bounds', () => {
  assert.throws(() => inverseStandardNormalCdfSavage(0));
  assert.throws(() => inverseStandardNormalCdfSavage(1));
  assert.throws(() => inverseStandardNormalCdfSavage(-0.1));
  assert.throws(() => inverseStandardNormalCdfSavage(1.5));
});

test('sav: aggregator returns degenerate result on empty input', () => {
  const r = aggregateSavageHalves([]);
  assert.equal(r.rowsUsed, 0);
  assert.equal(r.stoufferZ, 0);
  assert.equal(r.stoufferTwoSidedPValue, 1);
});

test('sav: aggregator combines unanimous positive signal', () => {
  const r = aggregateSavageHalves([
    { savZ: 2.0, savPValue: 0.0455, nTenureDays: 20 },
    { savZ: 2.5, savPValue: 0.0124, nTenureDays: 30 },
    { savZ: 1.8, savPValue: 0.0719, nTenureDays: 25 },
  ]);
  assert.equal(r.rowsUsed, 3);
  assert.ok(r.stoufferZ > 0, `expected +Z, got ${r.stoufferZ}`);
  assert.ok(r.stoufferTwoSidedPValue < 0.01);
});

test('sav: aggregator handles split signs (cancellation)', () => {
  const r = aggregateSavageHalves([
    { savZ: 2.0, savPValue: 0.0455, nTenureDays: 20 },
    { savZ: -2.0, savPValue: 0.0455, nTenureDays: 20 },
  ]);
  assert.equal(r.rowsUsed, 2);
  assert.ok(Math.abs(r.stoufferZ) < 1e-9);
  assert.ok(Math.abs(r.stoufferTwoSidedPValue - 1) < 1e-3);
});

test('sav: aggregator skips bad rows', () => {
  const r = aggregateSavageHalves([
    { savZ: Number.NaN, savPValue: 0.1, nTenureDays: 20 },
    { savZ: 1.5, savPValue: 1.5, nTenureDays: 20 },
    { savZ: 1.5, savPValue: 0.1, nTenureDays: -5 },
    { savZ: 2.0, savPValue: 0.04, nTenureDays: 20 },
  ]);
  assert.equal(r.rowsUsed, 1);
  assert.equal(r.rowsSkipped, 3);
});

test('sav: tenure-weighted mean reflects long-tenure rows', () => {
  const r = aggregateSavageHalves([
    { savZ: 1.0, savPValue: 0.3, nTenureDays: 10 },
    { savZ: 3.0, savPValue: 0.003, nTenureDays: 100 },
  ]);
  // unweighted mean = 2.0; tenure-weighted should pull toward 3.0
  assert.ok(Math.abs(r.meanSavZ - 2.0) < 1e-9);
  assert.ok(r.tenureWeightedMeanSavZ > 2.5);
});
