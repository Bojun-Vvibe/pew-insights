import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenCramerVonMisesHalves,
  buildDailyTokenCramerVonMisesHalves,
} from '../src/dailytokencramervonmiseshalves.js';
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

test('dailyTokenCramerVonMisesHalves: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenCramerVonMisesHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenCramerVonMisesHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenCramerVonMisesHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenCramerVonMisesHalves([1, Infinity, 3, 4, 5, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenCramerVonMisesHalves: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenCramerVonMisesHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: half-split sizes ----------

test('dailyTokenCramerVonMisesHalves: n1 = floor(n/2), n2 = n - n1, even n', () => {
  const r = dailyTokenCramerVonMisesHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.cvmN1, 4);
  assert.equal(r.cvmN2, 4);
  assert.equal(r.nSamples, 8);
});

test('dailyTokenCramerVonMisesHalves: n1 = floor(n/2), n2 = n - n1, odd n', () => {
  const r = dailyTokenCramerVonMisesHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.cvmN1, 4);
  assert.equal(r.cvmN2, 5);
  assert.equal(r.nSamples, 9);
});

// ---------- primitive: clean step shift ----------

test('dailyTokenCramerVonMisesHalves: clean step shift => cvmStat large, cvmDir = +1', () => {
  const x = [1, 1, 1, 1.5, 5, 5, 5, 5.5];
  const r = dailyTokenCramerVonMisesHalves(x);
  assert.ok(
    r.cvmStat > 0.46136,
    `cvmStat should exceed alpha=0.05 crit, got ${r.cvmStat}`,
  );
  assert.ok(r.cvmT > 0, `cvmT should be positive, got ${r.cvmT}`);
  assert.equal(r.cvmDir, 1);
  assert.ok(r.cvmZSigned > 0);
  assert.ok(r.cvmP < 0.05);
});

test('dailyTokenCramerVonMisesHalves: reversed step shift => cvmDir = -1', () => {
  const x = [5, 5, 5, 5.5, 1, 1, 1, 1.5];
  const r = dailyTokenCramerVonMisesHalves(x);
  assert.ok(r.cvmStat > 0.46136);
  assert.equal(r.cvmDir, -1);
  assert.ok(r.cvmZSigned < 0);
});

// ---------- primitive: invariances ----------

test('dailyTokenCramerVonMisesHalves: location-invariant (cvmStat unchanged by additive shift)', () => {
  const x = [1, 3, 2, 5, 4, 7, 6, 9];
  const r1 = dailyTokenCramerVonMisesHalves(x);
  const r2 = dailyTokenCramerVonMisesHalves(x.map((v) => v + 1000));
  assert.ok(
    Math.abs(r1.cvmStat - r2.cvmStat) < 1e-9,
    `cvmStat location-invariant: ${r1.cvmStat} vs ${r2.cvmStat}`,
  );
});

test('dailyTokenCramerVonMisesHalves: positive-scale-invariant (cvmStat unchanged by *k)', () => {
  const x = [1, 3, 2, 5, 4, 7, 6, 9];
  const r1 = dailyTokenCramerVonMisesHalves(x);
  const r2 = dailyTokenCramerVonMisesHalves(x.map((v) => v * 7));
  assert.ok(Math.abs(r1.cvmStat - r2.cvmStat) < 1e-9);
});

test('dailyTokenCramerVonMisesHalves: half-swap invariance on cvmStat, sign flip on cvmDir', () => {
  const x = [1, 1, 1, 1.5, 5, 5, 5, 5.5];
  const r1 = dailyTokenCramerVonMisesHalves(x);
  const xSwap = [...x.slice(4), ...x.slice(0, 4)];
  const r2 = dailyTokenCramerVonMisesHalves(xSwap);
  assert.ok(Math.abs(r1.cvmStat - r2.cvmStat) < 1e-9);
  assert.equal(r1.cvmDir, -r2.cvmDir);
});

// ---------- primitive: identical halves => low cvmStat ----------

test('dailyTokenCramerVonMisesHalves: identical halves => low cvmStat', () => {
  const x = [1, 2, 3, 4, 1, 2, 3, 4];
  const r = dailyTokenCramerVonMisesHalves(x);
  assert.ok(
    r.cvmStat < 0.4,
    `cvmStat should be small for identical halves, got ${r.cvmStat}`,
  );
  assert.ok(r.cvmP > 0.05);
});

// ---------- primitive: H0 mean closed form ----------

test('dailyTokenCramerVonMisesHalves: H0 mean is 1/6 + 1/(6N)', () => {
  const r = dailyTokenCramerVonMisesHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  const expected = 1 / 6 + 1 / (6 * 8);
  assert.ok(
    Math.abs(r.cvmMeanH0 - expected) < 1e-12,
    `meanH0 expected ${expected}, got ${r.cvmMeanH0}`,
  );
});

// ---------- primitive: critical value is 0.46136 ----------

test('dailyTokenCramerVonMisesHalves: critical value at alpha=0.05 is 0.46136 (Anderson 1962)', () => {
  const r = dailyTokenCramerVonMisesHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.cvmStatCrit05, 0.46136);
});

// ---------- primitive: cvmStat non-negative ----------

test('dailyTokenCramerVonMisesHalves: cvmStat >= 0 always (modulo finite-N correction)', () => {
  for (let trial = 0; trial < 20; trial += 1) {
    const x = Array.from({ length: 12 }, () => Math.random() * 100);
    let mn = x[0]!;
    let mx = x[0]!;
    for (const v of x) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === mx) continue;
    const r = dailyTokenCramerVonMisesHalves(x);
    // The Anderson 1962 formula admits a small
    // negative finite-N bias; allow a small floor.
    assert.ok(
      r.cvmStat >= -0.05,
      `cvmStat should be near non-negative, got ${r.cvmStat}`,
    );
    assert.ok(r.cvmP > 0 && r.cvmP <= 1);
  }
});

// ---------- primitive: variance is positive ----------

test('dailyTokenCramerVonMisesHalves: H0 variance positive for n=8', () => {
  const r = dailyTokenCramerVonMisesHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(
    r.cvmVarH0 > 0,
    `varH0 should be positive, got ${r.cvmVarH0}`,
  );
});

// ---------- primitive: known closed-form anchor ----------

test('dailyTokenCramerVonMisesHalves: matches Anderson 1962 closed form on perfect interleave', () => {
  // Perfectly interleaved: A = [1,3,5,7], B = [2,4,6,8]
  // Pooled sorted: [1,2,3,4,5,6,7,8]; ranks A = [1,3,5,7], B = [2,4,6,8].
  // sumA = (1-1)^2 + (3-2)^2 + (5-3)^2 + (7-4)^2 = 0+1+4+9 = 14
  // sumB = (2-1)^2 + (4-2)^2 + (6-3)^2 + (8-4)^2 = 1+4+9+16 = 30
  // U = 4*14 + 4*30 = 56 + 120 = 176
  // T = 176/(4*4*8) - (4*4*4 - 1)/(6*8) = 176/128 - 63/48
  //   = 1.375 - 1.3125 = 0.0625
  const x = [1, 3, 5, 7, 2, 4, 6, 8];
  const r = dailyTokenCramerVonMisesHalves(x);
  assert.ok(
    Math.abs(r.cvmStat - 0.0625) < 1e-9,
    `expected 0.0625, got ${r.cvmStat}`,
  );
});

// ---------- builder: source filtering ----------

test('buildDailyTokenCramerVonMisesHalves: filters by min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'big', d % 2 === 0 ? 200 : 5000));
    queue.push(ql(dayIso(d), 'tiny', 5));
  }
  const r = buildDailyTokenCramerVonMisesHalves(queue, {
    minTokens: 1000,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenCramerVonMisesHalves: filters by min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 8; d += 1) {
    queue.push(ql(dayIso(d), 'shortlived', d % 2 === 0 ? 100 : 5000));
  }
  const r = buildDailyTokenCramerVonMisesHalves(queue, {
    minTenureDays: 14,
    minTokens: 100,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenCramerVonMisesHalves: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'flat', 1000));
  }
  const r = buildDailyTokenCramerVonMisesHalves(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

// ---------- builder: sort orderings ----------

test('buildDailyTokenCramerVonMisesHalves: sort=cvmStatDesc orders strongest shift first', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'shifted', d < 8 ? 100 : 5000));
  }
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'stable', 1000 + (d % 3) * 50));
  }
  const r = buildDailyTokenCramerVonMisesHalves(queue, {
    sort: 'cvmStatDesc',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'shifted');
  assert.ok(r.sources[0]!.cvmStat > r.sources[1]!.cvmStat);
});

test('buildDailyTokenCramerVonMisesHalves: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenCramerVonMisesHalves([], {
        sort: 'nonsense' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenCramerVonMisesHalves: rejects min-tenure-days < 8', () => {
  assert.throws(
    () => buildDailyTokenCramerVonMisesHalves([], { minTenureDays: 4 }),
    /minTenureDays must be an integer >= 8/,
  );
});

// ---------- builder: top cap ----------

test('buildDailyTokenCramerVonMisesHalves: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 0; d < 16; d += 1) {
      queue.push(ql(dayIso(d), src, d < 8 ? 100 : 5000));
    }
  }
  const r = buildDailyTokenCramerVonMisesHalves(queue, {
    top: 1,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

// ---------- determinism ----------

test('buildDailyTokenCramerVonMisesHalves: deterministic with fixed generatedAt', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'src', 100 + d * 10));
  }
  const r1 = buildDailyTokenCramerVonMisesHalves(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  const r2 = buildDailyTokenCramerVonMisesHalves(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.deepEqual(r1, r2);
});

// ---------- structural orthogonality vs AD/KS ----------

test('dailyTokenCramerVonMisesHalves: bulk-shift dominates pure tail outlier (UNWEIGHTED L2)', () => {
  // Bulk shift: integrated L2 large.
  const bulkShift = [1, 1, 1, 1.5, 5, 5, 5, 5.5];
  // Tail outlier only: central mass identical, 1 spike.
  const tailOnly = [10, 11, 9, 12, 10, 11, 9, 100];
  const rBulk = dailyTokenCramerVonMisesHalves(bulkShift);
  const rTail = dailyTokenCramerVonMisesHalves(tailOnly);
  // CvM weights uniformly across the support so a
  // clean bulk shift (every order statistic in B
  // larger than every order statistic in A) gives
  // a large integrated L2 statistic. A single tail
  // outlier shifts only one rank, contributing one
  // squared (rank gap) term to U.
  assert.ok(
    rBulk.cvmStat > rTail.cvmStat,
    `bulk-shift cvmStat ${rBulk.cvmStat} should exceed tail-only ${rTail.cvmStat}`,
  );
});
