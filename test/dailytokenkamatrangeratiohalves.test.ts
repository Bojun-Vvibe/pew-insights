import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenKamatRangeRatioHalves,
  buildDailyTokenKamatRangeRatioHalves,
  medianKamat,
  rangeKamat,
  makeSplitMix32,
  fnv1aSeedKamat,
  standardNormalUpperTailKamat,
  aggregateKamatRangeRatioHalves,
} from '../src/dailytokenkamatrangeratiohalves.js';
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

// ---------- primitive: medianKamat ----------

test('medianKamat: odd-length picks middle', () => {
  assert.equal(medianKamat([3, 1, 2]), 2);
});

test('medianKamat: even-length averages middle two', () => {
  assert.equal(medianKamat([4, 1, 2, 3]), 2.5);
});

test('medianKamat: throws on empty', () => {
  assert.throws(() => medianKamat([]), /empty/);
});

// ---------- primitive: rangeKamat ----------

test('rangeKamat: simple range', () => {
  assert.equal(rangeKamat([3, 1, 5, 2]), 4);
});

test('rangeKamat: single element gives 0', () => {
  assert.equal(rangeKamat([7]), 0);
});

test('rangeKamat: all-equal gives 0', () => {
  assert.equal(rangeKamat([5, 5, 5, 5]), 0);
});

test('rangeKamat: throws on empty', () => {
  assert.throws(() => rangeKamat([]), /empty/);
});

// ---------- primitive: SplitMix32 PRNG ----------

test('makeSplitMix32: deterministic given the same seed', () => {
  const a = makeSplitMix32(42);
  const b = makeSplitMix32(42);
  for (let i = 0; i < 100; i += 1) {
    assert.equal(a(), b());
  }
});

test('makeSplitMix32: outputs in [0, 1)', () => {
  const r = makeSplitMix32(12345);
  for (let i = 0; i < 1000; i += 1) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('makeSplitMix32: different seeds produce different streams', () => {
  const a = makeSplitMix32(1);
  const b = makeSplitMix32(2);
  let diffs = 0;
  for (let i = 0; i < 50; i += 1) {
    if (a() !== b()) diffs += 1;
  }
  assert.ok(diffs > 40, `expected mostly different, got ${diffs}/50`);
});

// ---------- primitive: fnv1aSeedKamat ----------

test('fnv1aSeedKamat: deterministic for the same input', () => {
  assert.equal(fnv1aSeedKamat([1, 2, 3]), fnv1aSeedKamat([1, 2, 3]));
});

test('fnv1aSeedKamat: different inputs give different seeds', () => {
  assert.notEqual(fnv1aSeedKamat([1, 2, 3]), fnv1aSeedKamat([1, 2, 4]));
});

test('fnv1aSeedKamat: never returns 0 (avoids SplitMix32 degeneracy)', () => {
  // The sentinel branch trips if FNV-1a happens to land
  // on 0; check it's actually nonzero for many inputs.
  for (let i = 0; i < 100; i += 1) {
    assert.notEqual(fnv1aSeedKamat([i]), 0);
  }
});

// ---------- primitive: standardNormalUpperTailKamat ----------

test('standardNormalUpperTailKamat: Q(0) ~ 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailKamat(0) - 0.5) < 1e-7);
});

test('standardNormalUpperTailKamat: Q(1.96) ~ 0.025', () => {
  const q = standardNormalUpperTailKamat(1.96);
  assert.ok(Math.abs(q - 0.025) < 1e-4, `got ${q}`);
});

test('standardNormalUpperTailKamat: Q(-z) = 1 - Q(z)', () => {
  const z = 1.5;
  assert.ok(
    Math.abs(
      standardNormalUpperTailKamat(z) +
        standardNormalUpperTailKamat(-z) -
        1,
    ) < 1e-7,
  );
});

test('standardNormalUpperTailKamat: throws on non-finite', () => {
  assert.throws(() => standardNormalUpperTailKamat(Number.NaN));
});

// ---------- core: dailyTokenKamatRangeRatioHalves ----------

test('dailyTokenKamatRangeRatioHalves: throws on n < 16', () => {
  assert.throws(
    () =>
      dailyTokenKamatRangeRatioHalves(
        new Array(15).fill(0).map((_, i) => i + 1),
      ),
    /at least 16/,
  );
});

test('dailyTokenKamatRangeRatioHalves: throws on constant series', () => {
  assert.throws(
    () => dailyTokenKamatRangeRatioHalves(new Array(20).fill(7)),
    /zero centred variance/,
  );
});

test('dailyTokenKamatRangeRatioHalves: throws on non-finite values', () => {
  const v = new Array(20).fill(0).map((_, i) => i + 1);
  v[5] = Number.NaN;
  assert.throws(() => dailyTokenKamatRangeRatioHalves(v), /finite/);
});

test('dailyTokenKamatRangeRatioHalves: throws on permutations < 200', () => {
  const v = new Array(20).fill(0).map((_, i) => i + 1);
  assert.throws(
    () => dailyTokenKamatRangeRatioHalves(v, 100),
    /permutations/,
  );
});

test('dailyTokenKamatRangeRatioHalves: kamatStat invariant under permutation count (only variance changes)', () => {
  // The point estimate kamatStat = log(R_B/R_A) does
  // NOT depend on the permutation count; only the
  // variance estimator does. Two runs with different
  // permutations should produce identical kamatStat,
  // identical kamatRangeA / kamatRangeB, but DIFFERENT
  // kamatVar / kamatZ.
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const r1 = dailyTokenKamatRangeRatioHalves(x, 500);
  const r2 = dailyTokenKamatRangeRatioHalves(x, 1500);
  assert.equal(r1.kamatStat, r2.kamatStat);
  assert.equal(r1.kamatRangeA, r2.kamatRangeA);
  assert.equal(r1.kamatRangeB, r2.kamatRangeB);
  assert.equal(r1.kamatPermutations, 500);
  assert.equal(r2.kamatPermutations, 1500);
});

test('dailyTokenKamatRangeRatioHalves: kamatN1 = floor(n/2) for both even and odd n', () => {
  const xs = [16, 17, 18, 19, 20, 21];
  for (const n of xs) {
    const data = new Array(n).fill(0).map((_, i) => i + 1);
    const r = dailyTokenKamatRangeRatioHalves(data, 500);
    assert.equal(r.kamatN1, Math.floor(n / 2));
    assert.equal(r.kamatN2, n - Math.floor(n / 2));
    assert.equal(r.kamatN1 + r.kamatN2, n);
  }
});

test('dailyTokenKamatRangeRatioHalves: identical halves give kamatStat = 0', () => {
  // Two halves with identical post-alignment values
  // produce identical ranges, hence kamatStat = log(1)
  // = 0 exactly.
  const half = [1, 3, 2, 5, 4, 6, 7, 8];
  const r = dailyTokenKamatRangeRatioHalves([...half, ...half], 500);
  assert.equal(r.kamatRangeA, r.kamatRangeB);
  assert.equal(r.kamatStat, 0);
});

test('aggregateKamatRangeRatioHalves: opposite-sign Z cancel in Stouffer aggregator', () => {
  // Two rows with kamatZ = +2 and -2 should give
  // Stouffer Z = 0 (signed combination), high p ~= 1.
  const a = aggregateKamatRangeRatioHalves([
    { kamatZ: 2.0, kamatPValue: 0.046, kamatVar: 0.5, nTenureDays: 30 },
    { kamatZ: -2.0, kamatPValue: 0.046, kamatVar: 0.5, nTenureDays: 30 },
  ]);
  assert.ok(Math.abs(a.stoufferZ) < 1e-12);
  assert.ok(a.stoufferTwoSidedPValue > 0.99);
  assert.equal(a.rowsUsed, 2);
});

test('dailyTokenKamatRangeRatioHalves: shift-invariant (kamatZ unchanged by +c)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const y = x.map((v) => v + 1000);
  const rx = dailyTokenKamatRangeRatioHalves(x, 500);
  const ry = dailyTokenKamatRangeRatioHalves(y, 500);
  assert.ok(
    Math.abs(rx.kamatZ - ry.kamatZ) < 1e-9,
    `${rx.kamatZ} vs ${ry.kamatZ}`,
  );
});

test('dailyTokenKamatRangeRatioHalves: positive-scale invariant (kamatZ unchanged by *a)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const y = x.map((v) => v * 7.5);
  const rx = dailyTokenKamatRangeRatioHalves(x, 500);
  const ry = dailyTokenKamatRangeRatioHalves(y, 500);
  assert.ok(
    Math.abs(rx.kamatZ - ry.kamatZ) < 1e-9,
    `${rx.kamatZ} vs ${ry.kamatZ}`,
  );
});

test('dailyTokenKamatRangeRatioHalves: deterministic given the same input', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const r1 = dailyTokenKamatRangeRatioHalves(x, 500);
  const r2 = dailyTokenKamatRangeRatioHalves(x, 500);
  assert.equal(r1.kamatZ, r2.kamatZ);
  assert.equal(r1.kamatVar, r2.kamatVar);
  assert.equal(r1.kamatStat, r2.kamatStat);
});

test('dailyTokenKamatRangeRatioHalves: sign convention - second half MORE dispersed gives kamatZ > 0', () => {
  const a = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
  const b = [-100, -50, 0, 50, 100, -80, 80, -120, 120];
  const r = dailyTokenKamatRangeRatioHalves([...a, ...b], 1000);
  assert.ok(r.kamatZ > 0, `kamatZ=${r.kamatZ}`);
  assert.ok(r.kamatStat > 0, `kamatStat=${r.kamatStat}`);
  assert.ok(r.kamatRangeB > r.kamatRangeA);
});

test('dailyTokenKamatRangeRatioHalves: sign convention - first half MORE dispersed gives kamatZ < 0', () => {
  const a = [-100, -50, 0, 50, 100, -80, 80, -120, 120];
  const b = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
  const r = dailyTokenKamatRangeRatioHalves([...a, ...b], 1000);
  assert.ok(r.kamatZ < 0, `kamatZ=${r.kamatZ}`);
  assert.ok(r.kamatStat < 0, `kamatStat=${r.kamatStat}`);
});

test('dailyTokenKamatRangeRatioHalves: kamatStat = log(R_B / R_A) exactly', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const r = dailyTokenKamatRangeRatioHalves(x, 500);
  const expected = Math.log(r.kamatRangeB / r.kamatRangeA);
  assert.ok(Math.abs(r.kamatStat - expected) < 1e-12);
});

test('dailyTokenKamatRangeRatioHalves: kamatPValue in (0, 1]', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const r = dailyTokenKamatRangeRatioHalves(x, 500);
  assert.ok(r.kamatPValue > 0);
  assert.ok(r.kamatPValue <= 1);
});

test('dailyTokenKamatRangeRatioHalves: n1 = floor(n/2), n2 = n - n1', () => {
  const x = new Array(17).fill(0).map((_, i) => i + 1);
  const r = dailyTokenKamatRangeRatioHalves(x, 500);
  assert.equal(r.kamatN1, 8);
  assert.equal(r.kamatN2, 9);
});

// ---------- aggregate: aggregateKamatRangeRatioHalves ----------

test('aggregateKamatRangeRatioHalves: empty rows return zero stouffer', () => {
  const a = aggregateKamatRangeRatioHalves([]);
  assert.equal(a.stoufferZ, 0);
  assert.equal(a.stoufferTwoSidedPValue, 1);
  assert.equal(a.rowsUsed, 0);
});

test('aggregateKamatRangeRatioHalves: single positive Z passes through scaled by sqrt(1)=1', () => {
  const a = aggregateKamatRangeRatioHalves([
    {
      kamatZ: 2.0,
      kamatPValue: 0.0455,
      kamatVar: 0.5,
      nTenureDays: 30,
    },
  ]);
  assert.equal(a.stoufferZ, 2.0);
  assert.equal(a.rowsUsed, 1);
  assert.equal(a.meanKamatZ, 2.0);
  assert.equal(a.tenureWeightedMeanKamatZ, 2.0);
});

test('aggregateKamatRangeRatioHalves: Stouffer = sum / sqrt(m)', () => {
  const a = aggregateKamatRangeRatioHalves([
    { kamatZ: 1.0, kamatPValue: 0.3, kamatVar: 0.5, nTenureDays: 30 },
    { kamatZ: 2.0, kamatPValue: 0.05, kamatVar: 0.5, nTenureDays: 30 },
    { kamatZ: 3.0, kamatPValue: 0.003, kamatVar: 0.5, nTenureDays: 30 },
  ]);
  assert.ok(Math.abs(a.stoufferZ - 6.0 / Math.sqrt(3)) < 1e-12);
  assert.equal(a.rowsUsed, 3);
  assert.ok(Math.abs(a.meanKamatZ - 2.0) < 1e-12);
});

test('aggregateKamatRangeRatioHalves: skips malformed rows', () => {
  const a = aggregateKamatRangeRatioHalves([
    { kamatZ: 1.0, kamatPValue: 0.3, kamatVar: 0.5, nTenureDays: 30 },
    {
      kamatZ: Number.NaN,
      kamatPValue: 0.5,
      kamatVar: 0.5,
      nTenureDays: 30,
    },
    { kamatZ: 1.0, kamatPValue: 1.5, kamatVar: 0.5, nTenureDays: 30 }, // bad p
    { kamatZ: 1.0, kamatPValue: 0.3, kamatVar: -1, nTenureDays: 30 }, // bad var
    { kamatZ: 1.0, kamatPValue: 0.3, kamatVar: 0.5, nTenureDays: 0 }, // bad tenure
  ]);
  assert.equal(a.rowsUsed, 1);
  assert.equal(a.rowsSkipped, 4);
});

test('aggregateKamatRangeRatioHalves: tenure-weighted mean weights longer-tenure rows more', () => {
  const a = aggregateKamatRangeRatioHalves([
    { kamatZ: 1.0, kamatPValue: 0.3, kamatVar: 0.5, nTenureDays: 10 },
    { kamatZ: 3.0, kamatPValue: 0.003, kamatVar: 0.5, nTenureDays: 90 },
  ]);
  // unweighted mean = 2.0; weighted mean = (10*1 + 90*3)/100 = 2.8
  assert.ok(Math.abs(a.meanKamatZ - 2.0) < 1e-12);
  assert.ok(Math.abs(a.tenureWeightedMeanKamatZ - 2.8) < 1e-12);
});

// ---------- builder: buildDailyTokenKamatRangeRatioHalves ----------

test('buildDailyTokenKamatRangeRatioHalves: rejects bad minTokens', () => {
  assert.throws(
    () => buildDailyTokenKamatRangeRatioHalves([], { minTokens: -1 }),
    /minTokens/,
  );
});

test('buildDailyTokenKamatRangeRatioHalves: rejects bad minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenKamatRangeRatioHalves([], { minTenureDays: 8 }),
    /minTenureDays/,
  );
});

test('buildDailyTokenKamatRangeRatioHalves: rejects bad permutations', () => {
  assert.throws(
    () => buildDailyTokenKamatRangeRatioHalves([], { permutations: 50 }),
    /permutations/,
  );
});

test('buildDailyTokenKamatRangeRatioHalves: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenKamatRangeRatioHalves([], {
        sort: 'wat' as never,
      }),
    /sort/,
  );
});

test('buildDailyTokenKamatRangeRatioHalves: empty queue returns zero rows', () => {
  const r = buildDailyTokenKamatRangeRatioHalves([], {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenKamatRangeRatioHalves: end-to-end on synthetic per-source data', () => {
  const queue: QueueLine[] = [];
  // 20 days, source A with growing dispersion, source B
  // with constant dispersion.
  for (let i = 0; i < 20; i += 1) {
    const tokA = i < 10 ? 1000 + (i % 3) * 50 : 1000 + (i - 10) * 600;
    queue.push(ql(dayIso(i), 'srcA', tokA));
    queue.push(ql(dayIso(i), 'srcB', 1000 + (i % 5) * 100));
  }
  const r = buildDailyTokenKamatRangeRatioHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    permutations: 500,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 2);
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.kamatZ));
    assert.ok(s.kamatPValue > 0 && s.kamatPValue <= 1);
    assert.equal(s.kamatN1 + s.kamatN2, s.nTenureDays);
  }
  // srcA dispersion shifts up dramatically in second
  // half, so kamatZ should be positive.
  const srcA = r.sources.find((s) => s.source === 'srcA')!;
  assert.ok(srcA.kamatZ > 0, `srcA kamatZ=${srcA.kamatZ}`);
});
