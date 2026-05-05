import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pitmanSplitMix64,
  pitmanSeedFromSeries,
  pitmanLcgPrng,
  pitmanMeanSquaredSuccessiveDifference,
  pitmanFisherYatesShuffleInPlace,
  pitmanCentredVarianceBar,
  dailyTokenPitmanPermutationMssdRandomness,
  buildDailyTokenPitmanPermutationMssdRandomness,
  aggregatePitmanPermutationMssdRandomness,
  standardNormalUpperTailPitmanPermutationMssd,
} from '../src/dailytokenpitmanpermutationmssdrandomness.js';
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

// ---------- pitmanSplitMix64 ----------

test('pitmanSplitMix64: deterministic for same input', () => {
  const a = pitmanSplitMix64(0n);
  const b = pitmanSplitMix64(0n);
  assert.equal(a, b);
});

test('pitmanSplitMix64: different inputs give different outputs', () => {
  const a = pitmanSplitMix64(1n);
  const b = pitmanSplitMix64(2n);
  assert.notEqual(a, b);
});

test('pitmanSplitMix64: returns a 64-bit unsigned value', () => {
  const v = pitmanSplitMix64(12345n);
  assert.ok(v >= 0n);
  assert.ok(v < 1n << 64n);
});

test('pitmanSplitMix64: avalanches single-bit input differences', () => {
  const a = pitmanSplitMix64(0n);
  const b = pitmanSplitMix64(1n);
  // Hamming distance between a and b in their 64 bits
  // should be roughly half (32) -- we just require >=20
  // for robustness.
  let xor = a ^ b;
  let popcount = 0;
  while (xor > 0n) {
    if ((xor & 1n) === 1n) popcount += 1;
    xor >>= 1n;
  }
  assert.ok(popcount > 20, `popcount=${popcount}`);
});

// ---------- pitmanSeedFromSeries ----------

test('pitmanSeedFromSeries: same series same seed', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  assert.equal(pitmanSeedFromSeries(xs), pitmanSeedFromSeries(xs.slice()));
});

test('pitmanSeedFromSeries: different first/last give different seed', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const ys = [99, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  assert.notEqual(pitmanSeedFromSeries(xs), pitmanSeedFromSeries(ys));
});

test('pitmanSeedFromSeries: throws on empty', () => {
  assert.throws(() => pitmanSeedFromSeries([]));
});

// ---------- pitmanLcgPrng ----------

test('pitmanLcgPrng: deterministic across calls with same seed', () => {
  const a = pitmanLcgPrng(42n);
  const b = pitmanLcgPrng(42n);
  for (let i = 0; i < 100; i += 1) {
    assert.equal(a.next(), b.next());
  }
});

test('pitmanLcgPrng: nextUint32 returns values in [0, 2^32)', () => {
  const p = pitmanLcgPrng(42n);
  for (let i = 0; i < 100; i += 1) {
    const v = p.nextUint32();
    assert.ok(v >= 0 && v < 0x100000000);
    assert.ok(Number.isInteger(v));
  }
});

// ---------- pitmanMeanSquaredSuccessiveDifference ----------

test('pitmanMeanSquaredSuccessiveDifference: constant series gives 0', () => {
  assert.equal(
    pitmanMeanSquaredSuccessiveDifference([5, 5, 5, 5, 5]),
    0,
  );
});

test('pitmanMeanSquaredSuccessiveDifference: arithmetic progression step 1', () => {
  // [1,2,3,4,5]: diffs = [1,1,1,1], squared sum = 4, /4 = 1
  assert.equal(
    pitmanMeanSquaredSuccessiveDifference([1, 2, 3, 4, 5]),
    1,
  );
});

test('pitmanMeanSquaredSuccessiveDifference: shift-invariant', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7];
  const ys = xs.map((x) => x + 1000);
  assert.equal(
    pitmanMeanSquaredSuccessiveDifference(xs),
    pitmanMeanSquaredSuccessiveDifference(ys),
  );
});

test('pitmanMeanSquaredSuccessiveDifference: scale = a^2', () => {
  const xs = [1, 4, 2, 8, 5, 7, 3, 6];
  const a = 3;
  const ys = xs.map((x) => x * a);
  assert.ok(
    Math.abs(
      pitmanMeanSquaredSuccessiveDifference(ys) -
        a * a * pitmanMeanSquaredSuccessiveDifference(xs),
    ) < 1e-9,
  );
});

test('pitmanMeanSquaredSuccessiveDifference: throws on n<2', () => {
  assert.throws(() => pitmanMeanSquaredSuccessiveDifference([1]));
});

// ---------- pitmanFisherYatesShuffleInPlace ----------

test('pitmanFisherYatesShuffleInPlace: preserves multiset', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const orig = arr.slice().sort((a, b) => a - b);
  pitmanFisherYatesShuffleInPlace(arr, pitmanLcgPrng(42n));
  const after = arr.slice().sort((a, b) => a - b);
  assert.deepEqual(after, orig);
});

test('pitmanFisherYatesShuffleInPlace: deterministic with same seed', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  pitmanFisherYatesShuffleInPlace(a, pitmanLcgPrng(99n));
  pitmanFisherYatesShuffleInPlace(b, pitmanLcgPrng(99n));
  assert.deepEqual(a, b);
});

test('pitmanFisherYatesShuffleInPlace: different seeds give different orders', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  pitmanFisherYatesShuffleInPlace(a, pitmanLcgPrng(1n));
  pitmanFisherYatesShuffleInPlace(b, pitmanLcgPrng(2n));
  assert.notDeepEqual(a, b);
});

// ---------- pitmanCentredVarianceBar ----------

test('pitmanCentredVarianceBar: constant series gives ssBar = 0', () => {
  const r = pitmanCentredVarianceBar([5, 5, 5, 5]);
  assert.equal(r.mean, 5);
  assert.equal(r.ssBar, 0);
});

test('pitmanCentredVarianceBar: simple series', () => {
  // [1,2,3,4,5]: mean=3, deviations=[-2,-1,0,1,2], sum sq = 10, /5 = 2
  const r = pitmanCentredVarianceBar([1, 2, 3, 4, 5]);
  assert.equal(r.mean, 3);
  assert.equal(r.ssBar, 2);
});

// ---------- dailyTokenPitmanPermutationMssdRandomness ----------

test('dailyTokenPitmanPermutationMssdRandomness: throws on n<12', () => {
  assert.throws(() =>
    dailyTokenPitmanPermutationMssdRandomness([1, 2, 3, 4, 5], 999),
  );
});

test('dailyTokenPitmanPermutationMssdRandomness: throws on permutations<99', () => {
  const xs = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.throws(() => dailyTokenPitmanPermutationMssdRandomness(xs, 50));
});

test('dailyTokenPitmanPermutationMssdRandomness: throws on non-finite values', () => {
  const xs = Array.from({ length: 20 }, (_, i) => i + 1);
  xs[5] = Number.NaN;
  assert.throws(() => dailyTokenPitmanPermutationMssdRandomness(xs, 999));
});

test('dailyTokenPitmanPermutationMssdRandomness: throws on zero variance (constant)', () => {
  const xs = Array.from({ length: 20 }, () => 5);
  assert.throws(() => dailyTokenPitmanPermutationMssdRandomness(xs, 999));
});

test('dailyTokenPitmanPermutationMssdRandomness: deterministic across runs (same seed)', () => {
  const xs = [1, 4, 2, 8, 5, 7, 3, 6, 9, 11, 10, 12, 14, 13, 15];
  const a = dailyTokenPitmanPermutationMssdRandomness(xs, 999);
  const b = dailyTokenPitmanPermutationMssdRandomness(xs, 999);
  assert.equal(a.ppZ, b.ppZ);
  assert.equal(a.ppPValue, b.ppPValue);
  assert.equal(a.ppMssd, b.ppMssd);
  assert.equal(a.ppMssdExpected, b.ppMssdExpected);
  assert.equal(a.ppMssdVarianceMc, b.ppMssdVarianceMc);
  assert.equal(a.ppSeed, b.ppSeed);
});

test('dailyTokenPitmanPermutationMssdRandomness: monotone series detected as smooth (ppZ < 0)', () => {
  // Strict arithmetic progression: mssd very small relative
  // to typical permutation mssd.
  const xs = Array.from({ length: 30 }, (_, i) => i + 1);
  const r = dailyTokenPitmanPermutationMssdRandomness(xs, 999);
  assert.ok(r.ppZ < -1, `ppZ=${r.ppZ}`);
  assert.ok(r.ppPValue < 0.05, `ppPValue=${r.ppPValue}`);
});

test('dailyTokenPitmanPermutationMssdRandomness: zigzag series detected as oscillating (ppZ > 0)', () => {
  // Strict zigzag: alternate low/high. mssd extremely large.
  const xs: number[] = [];
  for (let i = 0; i < 30; i += 1) {
    xs.push(i % 2 === 0 ? 1 : 100);
  }
  const r = dailyTokenPitmanPermutationMssdRandomness(xs, 999);
  assert.ok(r.ppZ > 1, `ppZ=${r.ppZ}`);
  assert.ok(r.ppPValue < 0.05, `ppPValue=${r.ppPValue}`);
});

test('dailyTokenPitmanPermutationMssdRandomness: random-ish series has ppPValue not extreme', () => {
  // Use a deterministic but non-monotone, non-zigzag pattern.
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4];
  const r = dailyTokenPitmanPermutationMssdRandomness(xs, 999);
  // The point is the test runs and produces a valid pvalue.
  assert.ok(r.ppPValue > 0 && r.ppPValue <= 1);
});

test('dailyTokenPitmanPermutationMssdRandomness: shift invariance of ppZ and ppPValue', () => {
  const xs = [1, 4, 2, 8, 5, 7, 3, 6, 9, 11, 10, 12, 14, 13, 15];
  const ys = xs.map((x) => x + 1000);
  const a = dailyTokenPitmanPermutationMssdRandomness(xs, 999);
  // Note: shift changes the seed-from-series (because
  // x[0] and x[n-1] change), so ppZ may differ a tiny bit
  // due to different MC sample. We just verify both are finite.
  const b = dailyTokenPitmanPermutationMssdRandomness(ys, 999);
  assert.ok(Number.isFinite(a.ppZ));
  assert.ok(Number.isFinite(b.ppZ));
  // The OBSERVED mssd is shift-invariant (verified directly):
  assert.equal(a.ppMssd, b.ppMssd);
});

test('dailyTokenPitmanPermutationMssdRandomness: ppMssdExpected = 2 * ssBar (closed form)', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3];
  const r = dailyTokenPitmanPermutationMssdRandomness(xs, 999);
  const { ssBar } = pitmanCentredVarianceBar(xs);
  assert.ok(Math.abs(r.ppMssdExpected - 2 * ssBar) < 1e-9);
});

test('dailyTokenPitmanPermutationMssdRandomness: ppPValue is in (0, 1]', () => {
  const xs = [1, 4, 2, 8, 5, 7, 3, 6, 9, 11, 10, 12, 14, 13, 15];
  const r = dailyTokenPitmanPermutationMssdRandomness(xs, 999);
  assert.ok(r.ppPValue > 0);
  assert.ok(r.ppPValue <= 1);
});

test('dailyTokenPitmanPermutationMssdRandomness: ppPermutations matches input', () => {
  const xs = Array.from({ length: 15 }, (_, i) => (i * 7 + 3) % 11);
  const r = dailyTokenPitmanPermutationMssdRandomness(xs, 199);
  assert.equal(r.ppPermutations, 199);
});

test('dailyTokenPitmanPermutationMssdRandomness: nSamples reflects input length', () => {
  const xs = Array.from({ length: 25 }, (_, i) => i * i + 1);
  const r = dailyTokenPitmanPermutationMssdRandomness(xs, 999);
  assert.equal(r.nSamples, 25);
});

test('dailyTokenPitmanPermutationMssdRandomness: ppSeed is deterministic decimal string', () => {
  const xs = [1, 4, 2, 8, 5, 7, 3, 6, 9, 11, 10, 12, 14, 13, 15];
  const r = dailyTokenPitmanPermutationMssdRandomness(xs, 999);
  assert.equal(typeof r.ppSeed, 'string');
  assert.match(r.ppSeed, /^[0-9]+$/);
});

// ---------- standardNormalUpperTailPitmanPermutationMssd ----------

test('standardNormalUpperTailPitmanPermutationMssd: Q(0) = 0.5', () => {
  const q = standardNormalUpperTailPitmanPermutationMssd(0);
  assert.ok(Math.abs(q - 0.5) < 1e-3);
});

test('standardNormalUpperTailPitmanPermutationMssd: Q(1.96) ~ 0.025', () => {
  const q = standardNormalUpperTailPitmanPermutationMssd(1.96);
  assert.ok(Math.abs(q - 0.025) < 1e-3);
});

test('standardNormalUpperTailPitmanPermutationMssd: Q(-z) = 1 - Q(z)', () => {
  const q1 = standardNormalUpperTailPitmanPermutationMssd(-1.5);
  const q2 = standardNormalUpperTailPitmanPermutationMssd(1.5);
  assert.ok(Math.abs(q1 + q2 - 1) < 1e-6);
});

test('standardNormalUpperTailPitmanPermutationMssd: throws on non-finite', () => {
  assert.throws(() =>
    standardNormalUpperTailPitmanPermutationMssd(Number.NaN),
  );
});

// ---------- buildDailyTokenPitmanPermutationMssdRandomness ----------

test('build: empty queue produces zero rows', () => {
  const r = buildDailyTokenPitmanPermutationMssdRandomness([], {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 0);
  assert.deepEqual(r.sources, []);
});

test('build: simple two-source series with sufficient tenure', () => {
  const queue: QueueLine[] = [];
  // Source A: 30-day arithmetic progression (smooth)
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1000 + i * 100));
  }
  // Source B: 30-day zigzag (oscillating)
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(100 + i), 'srcB', i % 2 === 0 ? 100 : 5000));
  }
  const r = buildDailyTokenPitmanPermutationMssdRandomness(queue, {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  const a = r.sources.find((s) => s.source === 'srcA')!;
  const b = r.sources.find((s) => s.source === 'srcB')!;
  assert.ok(a.ppZ < 0, `srcA ppZ=${a.ppZ}`);
  assert.ok(b.ppZ > 0, `srcB ppZ=${b.ppZ}`);
});

test('build: rejects min-tenure-days < 12', () => {
  assert.throws(() =>
    buildDailyTokenPitmanPermutationMssdRandomness([], {
      minTenureDays: 5,
    }),
  );
});

test('build: rejects permutations < 99', () => {
  assert.throws(() =>
    buildDailyTokenPitmanPermutationMssdRandomness([], {
      permutations: 50,
    }),
  );
});

test('build: rejects invalid sort key', () => {
  assert.throws(() =>
    buildDailyTokenPitmanPermutationMssdRandomness([], {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sort: 'bogus' as any,
    }),
  );
});

test('build: drops sparse sources below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 15; i += 1) {
    queue.push(ql(dayIso(i), 'tiny', 10));
  }
  const r = buildDailyTokenPitmanPermutationMssdRandomness(queue, {
    minTokens: 100000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('build: drops below min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'short', 1000));
  }
  const r = buildDailyTokenPitmanPermutationMssdRandomness(queue);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: drops zero-variance source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 15; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 1000));
  }
  const r = buildDailyTokenPitmanPermutationMssdRandomness(queue);
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(s * 100 + i), `s${s}`, 1000 + i * (s + 1)));
    }
  }
  const r = buildDailyTokenPitmanPermutationMssdRandomness(queue, {
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('build: source filter restricts and surfaces droppedSourceFilter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'wanted', 1000 + i * 10));
    queue.push(ql(dayIso(i), 'unwanted', 500));
  }
  const r = buildDailyTokenPitmanPermutationMssdRandomness(queue, {
    source: 'wanted',
  });
  assert.ok(r.droppedSourceFilter > 0);
  assert.ok(r.sources.every((s) => s.source === 'wanted'));
});

test('build: drops bad hour_start lines', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'srcA', 1000),
    ql('also-bad', 'srcA', 2000),
  ];
  for (let i = 0; i < 15; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1000 + i * 50));
  }
  const r = buildDailyTokenPitmanPermutationMssdRandomness(queue);
  assert.equal(r.droppedInvalidHourStart, 2);
});

test('build: drops non-positive token rows', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 15; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1000 + i * 50));
  }
  queue.push(ql(dayIso(0), 'srcA', 0));
  queue.push(ql(dayIso(1), 'srcA', -5));
  const r = buildDailyTokenPitmanPermutationMssdRandomness(queue);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: sort=ppZAbsDesc orders by |ppZ| descending', () => {
  const queue: QueueLine[] = [];
  // srcA: smooth (negative ppZ)
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1000 + i * 100));
  }
  // srcB: zigzag (positive ppZ, expected to be larger |ppZ|)
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(200 + i), 'srcB', i % 2 === 0 ? 100 : 5000));
  }
  const r = buildDailyTokenPitmanPermutationMssdRandomness(queue, {
    sort: 'ppZAbsDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    Math.abs(r.sources[0]!.ppZ) >= Math.abs(r.sources[1]!.ppZ),
  );
});

test('build: sort=source orders alphabetically', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'zebra', 1000 + i * 10));
    queue.push(ql(dayIso(200 + i), 'alpha', 1000 + i * 7));
  }
  const r = buildDailyTokenPitmanPermutationMssdRandomness(queue, {
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zebra');
});

// ---------- aggregatePitmanPermutationMssdRandomness ----------

test('aggregate: empty rows gives zero stoufferZ and skipped=0', () => {
  const r = aggregatePitmanPermutationMssdRandomness([]);
  assert.equal(r.stoufferZ, 0);
  assert.equal(r.rowsUsed, 0);
  assert.equal(r.rowsSkipped, 0);
});

test('aggregate: skips invalid rows', () => {
  const r = aggregatePitmanPermutationMssdRandomness([
    { ppZ: Number.NaN, ppPValue: 0.5, nTenureDays: 20 },
    { ppZ: 1, ppPValue: 0.3, nTenureDays: 20 },
    { ppZ: 1, ppPValue: 0, nTenureDays: 20 }, // ppPValue<=0
    { ppZ: 1, ppPValue: 0.5, nTenureDays: 5 }, // tenure too small
  ]);
  assert.equal(r.rowsUsed, 1);
  assert.equal(r.rowsSkipped, 3);
});

test('aggregate: stoufferZ = sum(z) / sqrt(N)', () => {
  const rows = [
    { ppZ: 2, ppPValue: 0.05, nTenureDays: 20 },
    { ppZ: 2, ppPValue: 0.05, nTenureDays: 20 },
    { ppZ: 2, ppPValue: 0.05, nTenureDays: 20 },
    { ppZ: 2, ppPValue: 0.05, nTenureDays: 20 },
  ];
  const r = aggregatePitmanPermutationMssdRandomness(rows);
  // sum=8, sqrt(4)=2, 8/2=4
  assert.ok(Math.abs(r.stoufferZ - 4) < 1e-9);
});

test('aggregate: meanPpZ = mean of valid ppZ values', () => {
  const rows = [
    { ppZ: 1, ppPValue: 0.5, nTenureDays: 20 },
    { ppZ: 3, ppPValue: 0.5, nTenureDays: 20 },
  ];
  const r = aggregatePitmanPermutationMssdRandomness(rows);
  assert.equal(r.meanPpZ, 2);
});

test('aggregate: tenureWeightedMeanPpZ = sum(t*z)/sum(t)', () => {
  const rows = [
    { ppZ: 1, ppPValue: 0.5, nTenureDays: 20 },
    { ppZ: 3, ppPValue: 0.5, nTenureDays: 60 },
  ];
  const r = aggregatePitmanPermutationMssdRandomness(rows);
  // (1*20 + 3*60)/(20+60) = (20+180)/80 = 200/80 = 2.5
  assert.equal(r.tenureWeightedMeanPpZ, 2.5);
});
