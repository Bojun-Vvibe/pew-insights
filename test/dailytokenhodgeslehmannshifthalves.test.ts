import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenHodgesLehmannShiftHalves,
  buildDailyTokenHodgesLehmannShiftHalves,
  hodgesLehmannShift,
  inverseNormalCdfBsm,
  medianSortedHl,
  labelHlShiftHalvesRow,
} from '../src/dailytokenhodgeslehmannshifthalves.js';
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

// ---------- inverseNormalCdfBsm ----------

test('hl: inverseNormalCdfBsm Phi^-1(0.5) ~= 0', () => {
  assert.ok(Math.abs(inverseNormalCdfBsm(0.5)) < 1e-7);
});

test('hl: inverseNormalCdfBsm Phi^-1(0.975) ~= 1.96 (standard 95% z)', () => {
  assert.ok(Math.abs(inverseNormalCdfBsm(0.975) - 1.959_964) < 1e-4);
});

test('hl: inverseNormalCdfBsm Phi^-1(0.025) ~= -1.96', () => {
  assert.ok(Math.abs(inverseNormalCdfBsm(0.025) + 1.959_964) < 1e-4);
});

test('hl: inverseNormalCdfBsm symmetric around 0.5', () => {
  for (const p of [0.05, 0.1, 0.25, 0.45]) {
    const a = inverseNormalCdfBsm(p);
    const b = inverseNormalCdfBsm(1 - p);
    assert.ok(Math.abs(a + b) < 1e-6, `not symmetric at p=${p}`);
  }
});

test('hl: inverseNormalCdfBsm throws on p out of (0,1)', () => {
  assert.throws(() => inverseNormalCdfBsm(0));
  assert.throws(() => inverseNormalCdfBsm(1));
  assert.throws(() => inverseNormalCdfBsm(-0.1));
  assert.throws(() => inverseNormalCdfBsm(1.5));
  assert.throws(() => inverseNormalCdfBsm(Number.NaN));
});

// ---------- medianSortedHl ----------

test('hl: medianSortedHl odd length', () => {
  assert.equal(medianSortedHl([1, 2, 3, 4, 5]), 3);
});

test('hl: medianSortedHl even length averages middle two', () => {
  assert.equal(medianSortedHl([10, 20, 30, 40]), 25);
});

test('hl: medianSortedHl throws on empty', () => {
  assert.throws(() => medianSortedHl([]));
});

// ---------- hodgesLehmannShift primitive ----------

test('hl: hodgesLehmannShift two-sample with constant samples => zero shift', () => {
  const r = hodgesLehmannShift([5, 5, 5, 5, 5, 5, 5, 5], [5, 5, 5, 5, 5, 5, 5, 5], 0.05);
  assert.equal(r.hlDelta, 0);
  assert.equal(r.hlCiLow, 0);
  assert.equal(r.hlCiHigh, 0);
  assert.equal(r.hlPairs, 64);
});

test('hl: hodgesLehmannShift constant +c shift recovers c', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  const b = a.map((x) => x + 7);
  const r = hodgesLehmannShift(a, b, 0.05);
  assert.equal(r.hlDelta, 7);
});

test('hl: hodgesLehmannShift sign reverses on swapping samples', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  const b = [10, 11, 12, 13, 14, 15, 16, 17];
  const fwd = hodgesLehmannShift(a, b, 0.05);
  const rev = hodgesLehmannShift(b, a, 0.05);
  assert.ok(Math.abs(fwd.hlDelta + rev.hlDelta) < 1e-9);
});

test('hl: hodgesLehmannShift CI brackets the point estimate', () => {
  const a = [10, 20, 30, 40, 50, 60, 70, 80];
  const b = [50, 60, 70, 80, 90, 100, 110, 120];
  const r = hodgesLehmannShift(a, b, 0.05);
  assert.ok(r.hlCiLow <= r.hlDelta);
  assert.ok(r.hlDelta <= r.hlCiHigh);
});

test('hl: hodgesLehmannShift CI excludes 0 for clearly-shifted samples', () => {
  const a = Array.from({ length: 12 }, (_, i) => i + 1);
  const b = Array.from({ length: 12 }, (_, i) => i + 1 + 50);
  const r = hodgesLehmannShift(a, b, 0.05);
  assert.ok(r.hlCiLow > 0);
});

test('hl: hodgesLehmannShift CI includes 0 for identical samples', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = hodgesLehmannShift(a, b, 0.05);
  assert.ok(r.hlCiLow <= 0);
  assert.ok(r.hlCiHigh >= 0);
});

test('hl: hodgesLehmannShift narrower CI for tighter alpha=0.5', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const b = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const wide = hodgesLehmannShift(a, b, 0.05);
  const narrow = hodgesLehmannShift(a, b, 0.5);
  assert.ok(narrow.hlCiHigh - narrow.hlCiLow <= wide.hlCiHigh - wide.hlCiLow);
});

test('hl: hodgesLehmannShift throws on empty samples', () => {
  assert.throws(() => hodgesLehmannShift([], [1, 2, 3], 0.05));
  assert.throws(() => hodgesLehmannShift([1, 2, 3], [], 0.05));
});

test('hl: hodgesLehmannShift throws on non-finite alpha', () => {
  assert.throws(() => hodgesLehmannShift([1, 2], [3, 4], 0));
  assert.throws(() => hodgesLehmannShift([1, 2], [3, 4], -0.1));
  assert.throws(() => hodgesLehmannShift([1, 2], [3, 4], 0.6));
  assert.throws(() => hodgesLehmannShift([1, 2], [3, 4], Number.NaN));
});

test('hl: hodgesLehmannShift throws on non-finite values', () => {
  assert.throws(() => hodgesLehmannShift([1, Number.NaN], [3, 4], 0.05));
  assert.throws(() => hodgesLehmannShift([1, 2], [3, Number.POSITIVE_INFINITY], 0.05));
});

test('hl: hodgesLehmannShift hlPairs = nA * nB', () => {
  const a = [1, 2, 3, 4, 5];
  const b = [10, 11, 12, 13, 14, 15, 16];
  const r = hodgesLehmannShift(a, b, 0.05);
  assert.equal(r.hlPairs, 35);
});

// ---------- dailyTokenHodgesLehmannShiftHalves ----------

test('hl: dailyTokenHodgesLehmannShiftHalves throws on n<16', () => {
  assert.throws(() =>
    dailyTokenHodgesLehmannShiftHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 0.05),
  );
});

test('hl: dailyTokenHodgesLehmannShiftHalves zero variance throws', () => {
  const v = new Array(16).fill(7);
  assert.throws(() => dailyTokenHodgesLehmannShiftHalves(v, 0.05));
});

test('hl: dailyTokenHodgesLehmannShiftHalves monotone increasing => positive hlDelta and CI excludes 0', () => {
  const v = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenHodgesLehmannShiftHalves(v, 0.05);
  assert.ok(r.hlDelta > 0);
  assert.equal(r.hlSign, 1);
  assert.ok(r.hlCiExcludesZero);
});

test('hl: dailyTokenHodgesLehmannShiftHalves monotone decreasing => negative hlDelta and CI excludes 0', () => {
  const v = Array.from({ length: 20 }, (_, i) => 100 - i);
  const r = dailyTokenHodgesLehmannShiftHalves(v, 0.05);
  assert.ok(r.hlDelta < 0);
  assert.equal(r.hlSign, -1);
  assert.ok(r.hlCiExcludesZero);
});

test('hl: dailyTokenHodgesLehmannShiftHalves shift-equivariance in second half', () => {
  const v1 = Array.from({ length: 20 }, (_, i) => 10 + ((i * 17) % 13));
  const v2 = v1.map((x, i) => (i >= 10 ? x + 50 : x));
  const r1 = dailyTokenHodgesLehmannShiftHalves(v1, 0.05);
  const r2 = dailyTokenHodgesLehmannShiftHalves(v2, 0.05);
  assert.ok(Math.abs(r2.hlDelta - r1.hlDelta - 50) < 1e-9);
});

test('hl: dailyTokenHodgesLehmannShiftHalves scale-equivariance', () => {
  const v1 = Array.from({ length: 20 }, (_, i) => 10 + ((i * 17) % 13));
  const v2 = v1.map((x) => x * 3);
  const r1 = dailyTokenHodgesLehmannShiftHalves(v1, 0.05);
  const r2 = dailyTokenHodgesLehmannShiftHalves(v2, 0.05);
  assert.ok(Math.abs(r2.hlDelta - 3 * r1.hlDelta) < 1e-9);
});

test('hl: dailyTokenHodgesLehmannShiftHalves CI brackets the estimate', () => {
  const v = Array.from({ length: 24 }, (_, i) => Math.sin(i) + i * 0.5 + 10);
  const r = dailyTokenHodgesLehmannShiftHalves(v, 0.05);
  assert.ok(r.hlCiLow <= r.hlDelta);
  assert.ok(r.hlDelta <= r.hlCiHigh);
  assert.ok(r.hlCiWidth >= 0);
});

test('hl: dailyTokenHodgesLehmannShiftHalves n1, n2 sum to n', () => {
  const v = Array.from({ length: 25 }, (_, i) => i * i + 1);
  const r = dailyTokenHodgesLehmannShiftHalves(v, 0.05);
  assert.equal(r.hlN1 + r.hlN2, 25);
  assert.equal(r.hlN1, 12);
  assert.equal(r.hlN2, 13);
  assert.equal(r.hlPairs, 12 * 13);
});

// ---------- buildDailyTokenHodgesLehmannShiftHalves ----------

test('hl: buildDailyTokenHodgesLehmannShiftHalves filters source filter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 100_000 + i * 1000));
    queue.push(ql(dayIso(i), 'src-b', 200_000 - i * 500));
  }
  const r = buildDailyTokenHodgesLehmannShiftHalves(queue, { source: 'src-a' });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('hl: buildDailyTokenHodgesLehmannShiftHalves min-tokens drops sparse sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'big', 1_000_000 + i * 100));
    queue.push(ql(dayIso(i), 'small', 5));
  }
  const r = buildDailyTokenHodgesLehmannShiftHalves(queue, { minTokens: 1000 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('hl: buildDailyTokenHodgesLehmannShiftHalves sort by hlDeltaAbsDesc puts biggest |shift| first', () => {
  const queue: QueueLine[] = [];
  // src-a: monotone increasing big shift
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 10_000 + i * 100_000));
  }
  // src-b: oscillating small
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src-b', 50_000 + (i % 2) * 1000));
  }
  const r = buildDailyTokenHodgesLehmannShiftHalves(queue, {
    sort: 'hlDeltaAbsDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'src-a');
});

test('hl: buildDailyTokenHodgesLehmannShiftHalves invalid sort throws', () => {
  assert.throws(() =>
    buildDailyTokenHodgesLehmannShiftHalves([], {
      sort: 'bogus' as 'hlDelta',
    }),
  );
});

test('hl: buildDailyTokenHodgesLehmannShiftHalves invalid alpha throws', () => {
  assert.throws(() =>
    buildDailyTokenHodgesLehmannShiftHalves([], { alpha: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenHodgesLehmannShiftHalves([], { alpha: 0.6 }),
  );
});

test('hl: buildDailyTokenHodgesLehmannShiftHalves alpha propagates to hlCiLevel', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 's', 100_000 + i * 1000));
  }
  const r = buildDailyTokenHodgesLehmannShiftHalves(queue, { alpha: 0.1 });
  assert.equal(r.alpha, 0.1);
  assert.equal(r.sources[0]!.hlCiLevel, 0.9);
});

test('hl: buildDailyTokenHodgesLehmannShiftHalves invalid since throws', () => {
  assert.throws(() =>
    buildDailyTokenHodgesLehmannShiftHalves([], { since: 'not-a-date' }),
  );
});

test('hl: buildDailyTokenHodgesLehmannShiftHalves drops bad hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-iso', 's', 1000),
    ...Array.from({ length: 20 }, (_, i) => ql(dayIso(i), 's', 100_000 + i * 1000)),
  ];
  const r = buildDailyTokenHodgesLehmannShiftHalves(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('hl: buildDailyTokenHodgesLehmannShiftHalves drops below min-tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 's', 100_000 + i * 1000));
  }
  const r = buildDailyTokenHodgesLehmannShiftHalves(queue);
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('hl: buildDailyTokenHodgesLehmannShiftHalves top cap surfaces excess', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), `src-${s}`, 100_000 + i * (1000 + s * 500)));
    }
  }
  const r = buildDailyTokenHodgesLehmannShiftHalves(queue, { top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

// ---------- labelHlShiftHalvesRow ----------

test('hl: labelHlShiftHalvesRow CI excludes 0, sign +1 => second-decisive', () => {
  assert.equal(
    labelHlShiftHalvesRow({
      hlDelta: 100,
      hlCiLow: 50,
      hlCiHigh: 150,
      hlCiExcludesZero: true,
      hlSign: 1,
    }),
    'second-decisively-larger-by-shift',
  );
});

test('hl: labelHlShiftHalvesRow CI excludes 0, sign -1 => first-decisive', () => {
  assert.equal(
    labelHlShiftHalvesRow({
      hlDelta: -100,
      hlCiLow: -150,
      hlCiHigh: -50,
      hlCiExcludesZero: true,
      hlSign: -1,
    }),
    'first-decisively-larger-by-shift',
  );
});

test('hl: labelHlShiftHalvesRow CI includes 0, sign +1 => leans-second', () => {
  assert.equal(
    labelHlShiftHalvesRow({
      hlDelta: 10,
      hlCiLow: -5,
      hlCiHigh: 25,
      hlCiExcludesZero: false,
      hlSign: 1,
    }),
    'leans-second-larger-by-shift',
  );
});

test('hl: labelHlShiftHalvesRow CI includes 0, sign -1 => leans-first', () => {
  assert.equal(
    labelHlShiftHalvesRow({
      hlDelta: -10,
      hlCiLow: -25,
      hlCiHigh: 5,
      hlCiExcludesZero: false,
      hlSign: -1,
    }),
    'leans-first-larger-by-shift',
  );
});

test('hl: labelHlShiftHalvesRow sign 0 => no-detectable-shift', () => {
  assert.equal(
    labelHlShiftHalvesRow({
      hlDelta: 0,
      hlCiLow: -10,
      hlCiHigh: 10,
      hlCiExcludesZero: false,
      hlSign: 0,
    }),
    'no-detectable-shift',
  );
});

test('hl: labelHlShiftHalvesRow throws on non-finite or invalid CI ordering', () => {
  assert.throws(() =>
    labelHlShiftHalvesRow({
      hlDelta: Number.NaN,
      hlCiLow: 0,
      hlCiHigh: 1,
      hlCiExcludesZero: false,
      hlSign: 0,
    }),
  );
  assert.throws(() =>
    labelHlShiftHalvesRow({
      hlDelta: 5,
      hlCiLow: 10,
      hlCiHigh: 1,
      hlCiExcludesZero: false,
      hlSign: 1,
    }),
  );
  assert.throws(() =>
    labelHlShiftHalvesRow({
      hlDelta: 5,
      hlCiLow: 1,
      hlCiHigh: 10,
      hlCiExcludesZero: false,
      hlSign: 2 as -1 | 0 | 1,
    }),
  );
});
