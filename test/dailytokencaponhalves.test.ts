import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenCaponHalves,
  buildDailyTokenCaponHalves,
  midRanksCapon,
  medianCapon,
  standardNormalUpperTailCapon,
  inverseStandardNormalCdfCapon,
  aggregateCaponHalves,
} from '../src/dailytokencaponhalves.js';
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

// ---------- primitive: midRanksCapon ----------

test('midRanksCapon: strictly increasing 1..n', () => {
  assert.deepEqual(midRanksCapon([10, 20, 30, 40]), [1, 2, 3, 4]);
});

test('midRanksCapon: strictly decreasing n..1', () => {
  assert.deepEqual(midRanksCapon([40, 30, 20, 10]), [4, 3, 2, 1]);
});

test('midRanksCapon: ties get average rank', () => {
  assert.deepEqual(midRanksCapon([5, 5, 7, 5]), [2, 2, 4, 2]);
});

test('midRanksCapon: pair tie at top', () => {
  assert.deepEqual(midRanksCapon([1, 2, 9, 9]), [1, 2, 3.5, 3.5]);
});

// ---------- primitive: medianCapon ----------

test('medianCapon: odd-length picks middle', () => {
  assert.equal(medianCapon([3, 1, 2]), 2);
});

test('medianCapon: even-length averages two middle', () => {
  assert.equal(medianCapon([1, 2, 3, 4]), 2.5);
});

test('medianCapon: does not mutate input', () => {
  const a = [3, 1, 2];
  medianCapon(a);
  assert.deepEqual(a, [3, 1, 2]);
});

test('medianCapon: throws on empty', () => {
  assert.throws(() => medianCapon([]), /empty/);
});

// ---------- primitive: standardNormalUpperTailCapon ----------

test('standardNormalUpperTailCapon: Q(0) = 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailCapon(0) - 0.5) < 1e-7);
});

test('standardNormalUpperTailCapon: Q(-z) + Q(z) = 1', () => {
  const z = 1.234;
  const sum =
    standardNormalUpperTailCapon(z) + standardNormalUpperTailCapon(-z);
  assert.ok(Math.abs(sum - 1) < 1e-7);
});

test('standardNormalUpperTailCapon: Q(1.96) ~ 0.025', () => {
  assert.ok(Math.abs(standardNormalUpperTailCapon(1.96) - 0.025) < 1e-3);
});

test('standardNormalUpperTailCapon: rejects non-finite', () => {
  assert.throws(
    () => standardNormalUpperTailCapon(Number.NaN),
    /finite/,
  );
});

// ---------- primitive: inverseStandardNormalCdfCapon ----------

test('inverseStandardNormalCdfCapon: Phi^{-1}(0.5) = 0', () => {
  assert.ok(Math.abs(inverseStandardNormalCdfCapon(0.5)) < 1e-9);
});

test('inverseStandardNormalCdfCapon: Phi^{-1}(0.975) ~ 1.96', () => {
  assert.ok(Math.abs(inverseStandardNormalCdfCapon(0.975) - 1.96) < 1e-3);
});

test('inverseStandardNormalCdfCapon: symmetric Phi^{-1}(p) = -Phi^{-1}(1-p)', () => {
  const p = 0.137;
  const a = inverseStandardNormalCdfCapon(p);
  const b = inverseStandardNormalCdfCapon(1 - p);
  assert.ok(Math.abs(a + b) < 1e-7);
});

test('inverseStandardNormalCdfCapon: rejects out-of-bound p', () => {
  assert.throws(() => inverseStandardNormalCdfCapon(0), /\(0,1\)/);
  assert.throws(() => inverseStandardNormalCdfCapon(1), /\(0,1\)/);
  assert.throws(() => inverseStandardNormalCdfCapon(-0.1), /\(0,1\)/);
});

// ---------- core: dailyTokenCaponHalves ----------

test('dailyTokenCaponHalves: throws on n < 16', () => {
  assert.throws(
    () => dailyTokenCaponHalves(new Array(15).fill(0).map((_, i) => i + 1)),
    /at least 16/,
  );
});

test('dailyTokenCaponHalves: throws on constant series', () => {
  assert.throws(
    () => dailyTokenCaponHalves(new Array(20).fill(7)),
    /zero centred variance/,
  );
});

test('dailyTokenCaponHalves: throws on non-finite values', () => {
  const v = new Array(20).fill(0).map((_, i) => i + 1);
  v[5] = Number.NaN;
  assert.throws(() => dailyTokenCaponHalves(v), /finite/);
});

test('dailyTokenCaponHalves: shift-invariant (caponZ unchanged by +c)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const y = x.map((v) => v + 1000);
  const rx = dailyTokenCaponHalves(x);
  const ry = dailyTokenCaponHalves(y);
  assert.ok(Math.abs(rx.caponZ - ry.caponZ) < 1e-10);
});

test('dailyTokenCaponHalves: positive-scale invariant (caponZ unchanged by *a)', () => {
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
  ];
  const y = x.map((v) => v * 7.5);
  const rx = dailyTokenCaponHalves(x);
  const ry = dailyTokenCaponHalves(y);
  assert.ok(Math.abs(rx.caponZ - ry.caponZ) < 1e-10);
});

test('dailyTokenCaponHalves: sign convention -- second half MORE dispersed gives caponZ > 0', () => {
  const a = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
  const b = [-100, -50, 0, 50, 100, -80, 80, -120, 120];
  const r = dailyTokenCaponHalves([...a, ...b]);
  assert.ok(r.caponZ > 0);
  assert.ok(r.caponPValue < 0.1);
});

test('dailyTokenCaponHalves: sign convention -- first half MORE dispersed gives caponZ < 0', () => {
  const a = [-100, -50, 0, 50, 100, -80, 80, -120, 120];
  const b = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
  const r = dailyTokenCaponHalves([...a, ...b]);
  assert.ok(r.caponZ < 0);
});

test('dailyTokenCaponHalves: equal halves gives caponZ near 0', () => {
  const x = [
    -3, -2, -1, 0, 1, 2, 3, 0,
    -3, -2, -1, 0, 1, 2, 3, 0,
  ];
  const r = dailyTokenCaponHalves(x);
  assert.ok(Math.abs(r.caponZ) < 0.5);
  assert.ok(r.caponPValue > 0.3);
});

test('dailyTokenCaponHalves: returns expected fields with correct shapes', () => {
  const x = Array.from({ length: 20 }, (_, i) => Math.sin(i) + i * 0.1);
  const r = dailyTokenCaponHalves(x);
  assert.equal(r.nSamples, 20);
  assert.equal(r.caponN1, 10);
  assert.equal(r.caponN2, 10);
  assert.ok(Number.isFinite(r.caponZ));
  assert.ok(Number.isFinite(r.caponC));
  assert.ok(Math.abs(r.caponExpC - r.caponN2 * r.caponAbar) < 1e-10);
  assert.ok(r.caponVarC > 0);
  assert.ok(r.caponPValue >= 0 && r.caponPValue <= 1);
});

test('dailyTokenCaponHalves: uneven n splits as floor(n/2) | n - floor(n/2)', () => {
  const x = Array.from({ length: 17 }, (_, i) => i + 1);
  const r = dailyTokenCaponHalves(x);
  assert.equal(r.caponN1, 8);
  assert.equal(r.caponN2, 9);
});

test('dailyTokenCaponHalves: Capon extreme-rank score exceeds Klotz extreme-rank score', () => {
  // Structural orthogonality assertion: at the top rank
  // R = n, Capon plotting position (n - 0.5) / n yields a
  // STRICTLY LARGER squared-normal-quantile score than
  // Klotz's R / (n + 1) plotting position (the documented
  // ~30% extreme-rank weight gap at small n).
  const n = 16;
  const klotzExtreme = inverseStandardNormalCdfCapon(n / (n + 1)) ** 2;
  const caponExtreme = inverseStandardNormalCdfCapon((n - 0.5) / n) ** 2;
  assert.ok(caponExtreme > klotzExtreme);
  // Documented: Capon is ~30% larger for n = 16.
  assert.ok(caponExtreme / klotzExtreme > 1.2);
});

// ---------- core: buildDailyTokenCaponHalves ----------

test('buildDailyTokenCaponHalves: empty queue -> empty sources', () => {
  const r = buildDailyTokenCaponHalves([], { generatedAt: '2026-05-04T00:00:00Z' });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('buildDailyTokenCaponHalves: filters sparse sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'sparse', 1));
    queue.push(ql(dayIso(i), 'rich', 5000 + i * 100));
  }
  const r = buildDailyTokenCaponHalves(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'rich');
});

test('buildDailyTokenCaponHalves: filters below min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'short', 5000));
  }
  const r = buildDailyTokenCaponHalves(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenCaponHalves: rejects min-tenure-days < 16', () => {
  assert.throws(
    () =>
      buildDailyTokenCaponHalves([], {
        minTenureDays: 8,
        generatedAt: '2026-05-04T00:00:00Z',
      }),
    />= 16/,
  );
});

test('buildDailyTokenCaponHalves: rejects unknown sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenCaponHalves([], {
        sort: 'banana' as never,
        generatedAt: '2026-05-04T00:00:00Z',
      }),
    /sort must be/,
  );
});

test('buildDailyTokenCaponHalves: top truncates with droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    const seed = src.charCodeAt(0);
    for (let i = 0; i < 20; i += 1) {
      const v = 5000 + ((i * 137 + seed * 53) % 4000) + i * 11;
      queue.push(ql(dayIso(i), src, v));
    }
  }
  const r = buildDailyTokenCaponHalves(queue, {
    top: 2,
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenCaponHalves: source filter restricts and counts dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'keep', 5000 + i * 13));
    queue.push(ql(dayIso(i), 'skip', 7000));
  }
  const r = buildDailyTokenCaponHalves(queue, {
    source: 'keep',
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.ok(r.droppedSourceFilter > 0);
});

// ---------- aggregateCaponHalves: Stouffer signed combiner ----------

test('aggregateCaponHalves: empty input -> rowsUsed 0', () => {
  const r = aggregateCaponHalves([]);
  assert.equal(r.rowsUsed, 0);
  assert.equal(r.stoufferZ, 0);
  assert.equal(r.stoufferTwoSidedPValue, 1);
});

test('aggregateCaponHalves: skips malformed rows', () => {
  const r = aggregateCaponHalves([
    { caponZ: Number.NaN, caponPValue: 0.1, caponVarC: 1, nTenureDays: 20 },
    { caponZ: 1, caponPValue: 0, caponVarC: 1, nTenureDays: 20 },
    { caponZ: 1, caponPValue: 0.5, caponVarC: 0, nTenureDays: 20 },
    { caponZ: 1, caponPValue: 0.5, caponVarC: 1, nTenureDays: 0 },
  ]);
  assert.equal(r.rowsUsed, 0);
  assert.equal(r.rowsSkipped, 4);
});

test('aggregateCaponHalves: signed cancellation -- equal +z and -z give stoufferZ ~ 0', () => {
  const r = aggregateCaponHalves([
    { caponZ: 2.0, caponPValue: 0.0455, caponVarC: 1, nTenureDays: 20 },
    { caponZ: -2.0, caponPValue: 0.0455, caponVarC: 1, nTenureDays: 20 },
  ]);
  assert.equal(r.rowsUsed, 2);
  assert.ok(Math.abs(r.stoufferZ) < 1e-10);
  assert.ok(r.stoufferTwoSidedPValue > 0.99);
});

test('aggregateCaponHalves: same-sign reinforcement -- sqrt(m) scaling', () => {
  const r = aggregateCaponHalves(
    Array.from({ length: 4 }, () => ({
      caponZ: 2.0,
      caponPValue: 0.0455,
      caponVarC: 1,
      nTenureDays: 20,
    })),
  );
  assert.equal(r.rowsUsed, 4);
  assert.ok(Math.abs(r.stoufferZ - 4.0) < 1e-9);
  assert.ok(r.stoufferTwoSidedPValue < 1e-4);
});

test('aggregateCaponHalves: tenure weighting differs from unweighted mean', () => {
  const r = aggregateCaponHalves([
    { caponZ: 5, caponPValue: 1e-6, caponVarC: 1, nTenureDays: 1000 },
    { caponZ: -1, caponPValue: 0.317, caponVarC: 1, nTenureDays: 20 },
    { caponZ: -1, caponPValue: 0.317, caponVarC: 1, nTenureDays: 20 },
  ]);
  assert.ok(Math.abs(r.meanCaponZ - 1.0) < 1e-9);
  assert.ok(r.tenureWeightedMeanCaponZ > 4.5);
});
