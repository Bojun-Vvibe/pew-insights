import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenAndersonDarlingHalves,
  buildDailyTokenAndersonDarlingHalves,
} from '../src/dailytokenandersondarlinghalves.js';
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

// ---------- primitive: input validation ----------

test('dailyTokenAndersonDarlingHalves: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenAndersonDarlingHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenAndersonDarlingHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenAndersonDarlingHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenAndersonDarlingHalves([1, Infinity, 3, 4, 5, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenAndersonDarlingHalves: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenAndersonDarlingHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: half-split sizes ----------

test('dailyTokenAndersonDarlingHalves: n1 = floor(n/2), n2 = n - n1, even n', () => {
  const r = dailyTokenAndersonDarlingHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.adN1, 4);
  assert.equal(r.adN2, 4);
  assert.equal(r.nSamples, 8);
});

test('dailyTokenAndersonDarlingHalves: n1 = floor(n/2), n2 = n - n1, odd n', () => {
  const r = dailyTokenAndersonDarlingHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.adN1, 4);
  assert.equal(r.adN2, 5);
  assert.equal(r.nSamples, 9);
});

// ---------- primitive: clean step shift ----------

test('dailyTokenAndersonDarlingHalves: clean step shift => adA2 large, adDir = +1', () => {
  // first half all 1s (with one tweak), second half all 5s (with one tweak)
  const x = [1, 1, 1, 1.5, 5, 5, 5, 5.5];
  const r = dailyTokenAndersonDarlingHalves(x);
  assert.ok(r.adA2 > 1, `adA2 should exceed H0 mean of 1, got ${r.adA2}`);
  assert.ok(r.adT > 1.96, `adT should be significant, got ${r.adT}`);
  assert.equal(r.adDir, 1);
  assert.ok(r.adZSigned > 1.96);
  assert.ok(r.adP < 0.05);
});

test('dailyTokenAndersonDarlingHalves: reversed step shift => adDir = -1', () => {
  const x = [5, 5, 5, 5.5, 1, 1, 1, 1.5];
  const r = dailyTokenAndersonDarlingHalves(x);
  assert.ok(r.adA2 > 1);
  assert.equal(r.adDir, -1);
  assert.ok(r.adZSigned < 0);
});

// ---------- primitive: invariances ----------

test('dailyTokenAndersonDarlingHalves: location-invariant (adA2 unchanged by additive shift)', () => {
  const x = [1, 3, 2, 5, 4, 7, 6, 9];
  const r1 = dailyTokenAndersonDarlingHalves(x);
  const r2 = dailyTokenAndersonDarlingHalves(x.map((v) => v + 1000));
  assert.ok(
    Math.abs(r1.adA2 - r2.adA2) < 1e-9,
    `adA2 location-invariant: ${r1.adA2} vs ${r2.adA2}`,
  );
});

test('dailyTokenAndersonDarlingHalves: positive-scale-invariant (adA2 unchanged by *k)', () => {
  const x = [1, 3, 2, 5, 4, 7, 6, 9];
  const r1 = dailyTokenAndersonDarlingHalves(x);
  const r2 = dailyTokenAndersonDarlingHalves(x.map((v) => v * 7));
  assert.ok(Math.abs(r1.adA2 - r2.adA2) < 1e-9);
});

test('dailyTokenAndersonDarlingHalves: half-swap invariance on adA2, sign flip on adDir', () => {
  const x = [1, 1, 1, 1.5, 5, 5, 5, 5.5];
  const r1 = dailyTokenAndersonDarlingHalves(x);
  const xSwap = [...x.slice(4), ...x.slice(0, 4)];
  const r2 = dailyTokenAndersonDarlingHalves(xSwap);
  assert.ok(Math.abs(r1.adA2 - r2.adA2) < 1e-9);
  assert.equal(r1.adDir, -r2.adDir);
});

// ---------- primitive: identical halves => low adA2 ----------

test('dailyTokenAndersonDarlingHalves: identical halves => low adA2 (~0)', () => {
  const x = [1, 2, 3, 4, 1, 2, 3, 4];
  const r = dailyTokenAndersonDarlingHalves(x);
  assert.ok(r.adA2 < 0.5, `adA2 should be small for identical halves, got ${r.adA2}`);
  assert.ok(r.adP > 0.1);
});

// ---------- primitive: H0 mean is exactly 1 ----------

test('dailyTokenAndersonDarlingHalves: H0 mean is exactly 1 (k=2)', () => {
  const r = dailyTokenAndersonDarlingHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.adMeanH0, 1);
});

// ---------- primitive: critical value is 1.96 ----------

test('dailyTokenAndersonDarlingHalves: critical value at alpha=0.05 is 1.96', () => {
  const r = dailyTokenAndersonDarlingHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.adTCrit05, 1.96);
});

// ---------- primitive: adA2 non-negative ----------

test('dailyTokenAndersonDarlingHalves: adA2 >= 0 always', () => {
  for (let trial = 0; trial < 20; trial += 1) {
    const x = Array.from({ length: 12 }, () => Math.random() * 100);
    let mn = x[0]!;
    let mx = x[0]!;
    for (const v of x) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === mx) continue;
    const r = dailyTokenAndersonDarlingHalves(x);
    assert.ok(r.adA2 >= 0, `adA2 should be non-negative, got ${r.adA2}`);
    assert.ok(r.adP > 0 && r.adP <= 1);
  }
});

// ---------- primitive: variance is positive ----------

test('dailyTokenAndersonDarlingHalves: H0 variance positive for n=8', () => {
  const r = dailyTokenAndersonDarlingHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(r.adVarH0 > 0, `varH0 should be positive, got ${r.adVarH0}`);
});

// ---------- builder: source filtering ----------

test('buildDailyTokenAndersonDarlingHalves: filters by min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'big', d % 2 === 0 ? 200 : 5000));
    queue.push(ql(dayIso(d), 'tiny', 5));
  }
  const r = buildDailyTokenAndersonDarlingHalves(queue, {
    minTokens: 1000,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenAndersonDarlingHalves: filters by min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 8; d += 1) {
    queue.push(ql(dayIso(d), 'shortlived', d % 2 === 0 ? 100 : 5000));
  }
  const r = buildDailyTokenAndersonDarlingHalves(queue, {
    minTenureDays: 14,
    minTokens: 100,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenAndersonDarlingHalves: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'flat', 1000));
  }
  const r = buildDailyTokenAndersonDarlingHalves(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

// ---------- builder: sort orderings ----------

test('buildDailyTokenAndersonDarlingHalves: sort=adA2Desc orders strongest shift first', () => {
  const queue: QueueLine[] = [];
  // src1: clean shift between halves
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'shifted', d < 8 ? 100 : 5000));
  }
  // src2: stable
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'stable', 1000 + (d % 3) * 50));
  }
  const r = buildDailyTokenAndersonDarlingHalves(queue, {
    sort: 'adA2Desc',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'shifted');
  assert.ok(r.sources[0]!.adA2 > r.sources[1]!.adA2);
});

test('buildDailyTokenAndersonDarlingHalves: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenAndersonDarlingHalves([], {
        sort: 'nonsense' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenAndersonDarlingHalves: rejects min-tenure-days < 8', () => {
  assert.throws(
    () => buildDailyTokenAndersonDarlingHalves([], { minTenureDays: 4 }),
    /minTenureDays must be an integer >= 8/,
  );
});

// ---------- builder: top cap ----------

test('buildDailyTokenAndersonDarlingHalves: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 0; d < 16; d += 1) {
      queue.push(ql(dayIso(d), src, d < 8 ? 100 : 5000));
    }
  }
  const r = buildDailyTokenAndersonDarlingHalves(queue, {
    top: 1,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

// ---------- determinism ----------

test('buildDailyTokenAndersonDarlingHalves: deterministic with fixed generatedAt', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'src', 100 + d * 10));
  }
  const r1 = buildDailyTokenAndersonDarlingHalves(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  const r2 = buildDailyTokenAndersonDarlingHalves(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.deepEqual(r1, r2);
});

// ---------- structural orthogonality vs KS ----------

test('dailyTokenAndersonDarlingHalves: tail-only difference amplified relative to median', () => {
  // Both halves share central mass, but second half has tail outlier
  const x = [10, 11, 9, 12, 10, 11, 9, 100];
  const r = dailyTokenAndersonDarlingHalves(x);
  // adA2 should be sensitive to the tail outlier
  assert.ok(r.adA2 > 0);
  assert.ok(Number.isFinite(r.adT));
});
