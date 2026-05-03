import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenMaxDivergenceHalves,
  buildDailyTokenMaxDivergenceHalves,
  MAXDIV_GRID_K,
  MAXDIV_SILVERMAN_MULTIPLIER,
  MAXDIV_GRID_EXTENSION_H,
} from '../src/dailytokenmaxdivergencehalves.js';
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

test('maxDiv primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('maxDiv primitive: accepts exactly 8 samples', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.maxDivN1, 4);
  assert.equal(r.maxDivN2, 4);
});

test('maxDiv primitive: rejects NaN', () => {
  assert.throws(
    () => dailyTokenMaxDivergenceHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
});

test('maxDiv primitive: rejects +Infinity', () => {
  assert.throws(
    () => dailyTokenMaxDivergenceHalves([1, 2, 3, 4, Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('maxDiv primitive: rejects -Infinity', () => {
  assert.throws(
    () => dailyTokenMaxDivergenceHalves([1, 2, 3, 4, -Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('maxDiv primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenMaxDivergenceHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('maxDiv primitive: n1 = floor(n/2), n2 = n - n1 (even)', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.maxDivN1, 5);
  assert.equal(r.maxDivN2, 5);
});

test('maxDiv primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.maxDivN1, 4);
  assert.equal(r.maxDivN2, 5);
});

test('maxDiv primitive: gridK === MAXDIV_GRID_K', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.maxDivGridK, MAXDIV_GRID_K);
  assert.equal(r.maxDivGridK, 257);
});

test('maxDiv primitive: bandwidth > 0', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.maxDivBandwidth > 0);
});

test('maxDiv primitive: nSamples reflects input length', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.nSamples, 10);
});

test('maxDiv primitive: grid is monotone (gHi > gLo)', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.maxDivGridHi > r.maxDivGridLo);
  assert.ok(r.maxDivGridDx > 0);
});

test('maxDiv primitive: dx === (gHi-gLo)/(K-1)', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const expected = (r.maxDivGridHi - r.maxDivGridLo) / (MAXDIV_GRID_K - 1);
  assert.ok(Math.abs(r.maxDivGridDx - expected) < 1e-12);
});

// ---------- primitive: maxDiv mathematical bounds ----------

test('maxDiv primitive: maxDiv >= 0', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.maxDiv >= 0);
});

test('maxDiv primitive: maxDiv <= 1', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.maxDiv <= 1);
});

test('maxDiv primitive: tvDist >= 0', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.tvDist >= 0);
});

test('maxDiv primitive: tvDist <= 1', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.tvDist <= 1 + 1e-12);
});

test('maxDiv primitive: Holder upper bound maxDiv <= 2*tvDist', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.maxDiv <= 2 * r.tvDist + 1e-12);
});

test('maxDiv primitive: Holder lower bound maxDiv >= (2/K)*tvDist', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.maxDiv + 1e-12 >= (2 / MAXDIV_GRID_K) * r.tvDist);
});

test('maxDiv primitive: maxDivLinfL1Ratio in [1/K, 1] when tvDist > 0', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.tvDist > 0);
  assert.ok(r.maxDivLinfL1Ratio >= 1 / MAXDIV_GRID_K - 1e-12);
  assert.ok(r.maxDivLinfL1Ratio <= 1 + 1e-12);
});

test('maxDiv primitive: argMaxBucketIndex in [0, K-1]', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(Number.isInteger(r.argMaxBucketIndex));
  assert.ok(r.argMaxBucketIndex >= 0);
  assert.ok(r.argMaxBucketIndex < MAXDIV_GRID_K);
});

test('maxDiv primitive: argMaxBucketX === gLo + idx*dx', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  const expected = r.maxDivGridLo + r.argMaxBucketIndex * r.maxDivGridDx;
  assert.ok(Math.abs(r.argMaxBucketX - expected) < 1e-9);
});

test('maxDiv primitive: argMaxPK and argMaxQK in [0, 1]', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.argMaxPK >= 0);
  assert.ok(r.argMaxPK <= 1);
  assert.ok(r.argMaxQK >= 0);
  assert.ok(r.argMaxQK <= 1);
});

test('maxDiv primitive: |argMaxPK - argMaxQK| === maxDiv', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(Math.abs(Math.abs(r.argMaxPK - r.argMaxQK) - r.maxDiv) < 1e-12);
});

test('maxDiv primitive: argMaxSign === sign(argMaxPK - argMaxQK)', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  const expectedSign =
    r.argMaxPK > r.argMaxQK ? 1 : r.argMaxPK < r.argMaxQK ? -1 : 0;
  assert.equal(r.argMaxSign, expectedSign);
});

test('maxDiv primitive: argMaxSign in {-1, 0, +1}', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.argMaxSign === -1 || r.argMaxSign === 0 || r.argMaxSign === 1);
});

test('maxDiv primitive: when halves are concentrated apart, maxDiv > 0', () => {
  const r = dailyTokenMaxDivergenceHalves([
    1, 2, 3, 4, 1000, 1001, 1002, 1003,
  ]);
  assert.ok(r.maxDiv > 0);
});

test('maxDiv primitive: when halves are distinct, tvDist > 0', () => {
  const r = dailyTokenMaxDivergenceHalves([
    1, 2, 3, 4, 1000, 1001, 1002, 1003,
  ]);
  assert.ok(r.tvDist > 0);
});

// ---------- primitive: invariances ----------

test('maxDiv primitive: translation invariance maxDiv(x+c) === maxDiv(x)', () => {
  const x = [1, 2, 3, 4, 100, 200, 300, 400, 5, 6];
  const r1 = dailyTokenMaxDivergenceHalves(x);
  const r2 = dailyTokenMaxDivergenceHalves(x.map((v) => v + 12345));
  assert.ok(Math.abs(r1.maxDiv - r2.maxDiv) < 1e-9);
});

test('maxDiv primitive: translation invariance preserves tvDist', () => {
  const x = [1, 2, 3, 4, 100, 200, 300, 400, 5, 6];
  const r1 = dailyTokenMaxDivergenceHalves(x);
  const r2 = dailyTokenMaxDivergenceHalves(x.map((v) => v + 99));
  assert.ok(Math.abs(r1.tvDist - r2.tvDist) < 1e-9);
});

test('maxDiv primitive: translation invariance preserves maxDivLinfL1Ratio', () => {
  const x = [1, 2, 3, 4, 100, 200, 300, 400, 5, 6];
  const r1 = dailyTokenMaxDivergenceHalves(x);
  const r2 = dailyTokenMaxDivergenceHalves(x.map((v) => v + 100));
  assert.ok(
    Math.abs(r1.maxDivLinfL1Ratio - r2.maxDivLinfL1Ratio) < 1e-9,
  );
});

test('maxDiv primitive: positive scale invariance maxDiv(k*x) === maxDiv(x)', () => {
  const x = [1, 2, 3, 4, 100, 200, 300, 400, 5, 6];
  const r1 = dailyTokenMaxDivergenceHalves(x);
  const r2 = dailyTokenMaxDivergenceHalves(x.map((v) => v * 7));
  assert.ok(Math.abs(r1.maxDiv - r2.maxDiv) < 1e-9);
});

test('maxDiv primitive: positive scale invariance preserves tvDist', () => {
  const x = [1, 2, 3, 4, 100, 200, 300, 400, 5, 6];
  const r1 = dailyTokenMaxDivergenceHalves(x);
  const r2 = dailyTokenMaxDivergenceHalves(x.map((v) => v * 0.5));
  assert.ok(Math.abs(r1.tvDist - r2.tvDist) < 1e-9);
});

test('maxDiv primitive: positive scale invariance preserves argMaxSign', () => {
  const x = [1, 2, 3, 4, 100, 200, 300, 400, 5, 6];
  const r1 = dailyTokenMaxDivergenceHalves(x);
  const r2 = dailyTokenMaxDivergenceHalves(x.map((v) => v * 3));
  assert.equal(r1.argMaxSign, r2.argMaxSign);
});

test('maxDiv primitive: bandwidth scales linearly with positive scale', () => {
  const x = [1, 2, 3, 4, 100, 200, 300, 400, 5, 6];
  const r1 = dailyTokenMaxDivergenceHalves(x);
  const r2 = dailyTokenMaxDivergenceHalves(x.map((v) => v * 4));
  assert.ok(Math.abs(r2.maxDivBandwidth - 4 * r1.maxDivBandwidth) < 1e-6);
});

test('maxDiv primitive: combined translation+scale invariant', () => {
  const x = [1, 2, 3, 4, 100, 200, 300, 400, 5, 6];
  const r1 = dailyTokenMaxDivergenceHalves(x);
  const r2 = dailyTokenMaxDivergenceHalves(
    x.map((v) => v * 3 + 50),
  );
  assert.ok(Math.abs(r1.maxDiv - r2.maxDiv) < 1e-9);
});

// ---------- primitive: symmetry ----------

test('maxDiv primitive: swapping halves preserves maxDiv', () => {
  const x = [1, 2, 3, 4, 100, 200, 300, 400];
  const swapped = [100, 200, 300, 400, 1, 2, 3, 4];
  const r1 = dailyTokenMaxDivergenceHalves(x);
  const r2 = dailyTokenMaxDivergenceHalves(swapped);
  assert.ok(Math.abs(r1.maxDiv - r2.maxDiv) < 1e-12);
});

test('maxDiv primitive: swapping halves preserves tvDist', () => {
  const x = [1, 2, 3, 4, 100, 200, 300, 400];
  const swapped = [100, 200, 300, 400, 1, 2, 3, 4];
  const r1 = dailyTokenMaxDivergenceHalves(x);
  const r2 = dailyTokenMaxDivergenceHalves(swapped);
  assert.ok(Math.abs(r1.tvDist - r2.tvDist) < 1e-12);
});

test('maxDiv primitive: swapping halves flips argMaxSign', () => {
  const x = [1, 2, 3, 4, 100, 200, 300, 400];
  const swapped = [100, 200, 300, 400, 1, 2, 3, 4];
  const r1 = dailyTokenMaxDivergenceHalves(x);
  const r2 = dailyTokenMaxDivergenceHalves(swapped);
  assert.equal(r1.argMaxSign, -r2.argMaxSign);
});

test('maxDiv primitive: swapping halves preserves argMaxBucketIndex', () => {
  const x = [1, 2, 3, 4, 100, 200, 300, 400];
  const swapped = [100, 200, 300, 400, 1, 2, 3, 4];
  const r1 = dailyTokenMaxDivergenceHalves(x);
  const r2 = dailyTokenMaxDivergenceHalves(swapped);
  assert.equal(r1.argMaxBucketIndex, r2.argMaxBucketIndex);
});

// ---------- primitive: identical-half pathology ----------

test('maxDiv primitive: identical halves give very small maxDiv', () => {
  // Even halves: [1,2,3,4 | 1,2,3,4] — identical. KDE should be near-equal.
  // Use slight jitter to avoid zero-variance throw.
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 1, 2, 3, 4.0001]);
  assert.ok(r.maxDiv < 0.01);
});

test('maxDiv primitive: identical halves give very small tvDist', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 1, 2, 3, 4.0001]);
  assert.ok(r.tvDist < 0.05);
});

// ---------- primitive: monotone-shift behaviour ----------

test('maxDiv primitive: increasing the gap between halves changes maxDiv (not flat)', () => {
  const r1 = dailyTokenMaxDivergenceHalves([
    10, 11, 12, 13, 20, 21, 22, 23,
  ]);
  const r2 = dailyTokenMaxDivergenceHalves([
    10, 11, 12, 13, 1000, 1001, 1002, 1003,
  ]);
  // Both should be > 0 and non-trivially different.
  assert.ok(r1.maxDiv > 0);
  assert.ok(r2.maxDiv > 0);
  assert.ok(Math.abs(r1.maxDiv - r2.maxDiv) > 1e-6);
});

test('maxDiv primitive: increasing the gap never decreases tvDist', () => {
  const r1 = dailyTokenMaxDivergenceHalves([
    10, 11, 12, 13, 20, 21, 22, 23,
  ]);
  const r2 = dailyTokenMaxDivergenceHalves([
    10, 11, 12, 13, 1000, 1001, 1002, 1003,
  ]);
  assert.ok(r2.tvDist > r1.tvDist);
});

// ---------- primitive: numerical sanity ----------

test('maxDiv primitive: all stats finite', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(Number.isFinite(r.maxDiv));
  assert.ok(Number.isFinite(r.tvDist));
  assert.ok(Number.isFinite(r.maxDivLinfL1Ratio));
  assert.ok(Number.isFinite(r.argMaxBucketX));
  assert.ok(Number.isFinite(r.argMaxPK));
  assert.ok(Number.isFinite(r.argMaxQK));
});

test('maxDiv primitive: madPool >= 0', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.maxDivMadPool >= 0);
});

test('maxDiv primitive: stddev > 0 for varying input', () => {
  const r = dailyTokenMaxDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.stddev > 0);
});

test('maxDiv primitive: mean equals arithmetic mean', () => {
  const x = [1, 2, 3, 4, 100, 200, 300, 400];
  const r = dailyTokenMaxDivergenceHalves(x);
  const mu = x.reduce((a, b) => a + b, 0) / x.length;
  assert.ok(Math.abs(r.mean - mu) < 1e-9);
});

// ---------- primitive: constants ----------

test('constants: MAXDIV_GRID_K === 257', () => {
  assert.equal(MAXDIV_GRID_K, 257);
});

test('constants: MAXDIV_SILVERMAN_MULTIPLIER === 0.9', () => {
  assert.ok(Math.abs(MAXDIV_SILVERMAN_MULTIPLIER - 0.9) < 1e-12);
});

test('constants: MAXDIV_GRID_EXTENSION_H === 3', () => {
  assert.equal(MAXDIV_GRID_EXTENSION_H, 3);
});

// ---------- builder: option validation ----------

test('build: rejects negative minTokens', () => {
  assert.throws(
    () => buildDailyTokenMaxDivergenceHalves([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('build: rejects non-integer minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenMaxDivergenceHalves([], { minTenureDays: 7.5 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects below-floor minTenureDays', () => {
  assert.throws(
    () => buildDailyTokenMaxDivergenceHalves([], { minTenureDays: 7 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: accepts minTenureDays === 8', () => {
  const r = buildDailyTokenMaxDivergenceHalves([], { minTenureDays: 8 });
  assert.equal(r.minTenureDays, 8);
});

test('build: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenMaxDivergenceHalves([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('build: rejects non-integer top', () => {
  assert.throws(
    () => buildDailyTokenMaxDivergenceHalves([], { top: 1.5 }),
    /top must be a non-negative integer/,
  );
});

test('build: rejects invalid sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenMaxDivergenceHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: rejects invalid since', () => {
  assert.throws(
    () =>
      buildDailyTokenMaxDivergenceHalves([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('build: rejects invalid until', () => {
  assert.throws(
    () =>
      buildDailyTokenMaxDivergenceHalves([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

// ---------- builder: end-to-end & sorting ----------

function makeQueueWithTwoSources(): QueueLine[] {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    const v = i < 10 ? 100 + (i % 3) * 10 : 1000 + (i % 3) * 10;
    q.push(ql(dayIso(i), 'src-a', v));
  }
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'src-b', 500 + ((i * 7) % 11)));
  }
  return q;
}

test('build: returns rows for two-source fixture', () => {
  const r = buildDailyTokenMaxDivergenceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.gridK, MAXDIV_GRID_K);
  assert.ok(Math.abs(r.silvermanMultiplier - 0.9) < 1e-12);
});

test('build: default sort is maxDivDesc', () => {
  const r = buildDailyTokenMaxDivergenceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
  });
  assert.equal(r.sort, 'maxDivDesc');
  assert.ok(r.sources[0]!.maxDiv >= r.sources[1]!.maxDiv);
});

test('build: sort maxDiv asc puts smallest first', () => {
  const r = buildDailyTokenMaxDivergenceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'maxDiv',
  });
  assert.ok(r.sources[0]!.maxDiv <= r.sources[1]!.maxDiv);
});

test('build: sort maxDivLinfL1Ratio asc puts smallest first', () => {
  const r = buildDailyTokenMaxDivergenceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'maxDivLinfL1Ratio',
  });
  assert.ok(
    r.sources[0]!.maxDivLinfL1Ratio <= r.sources[1]!.maxDivLinfL1Ratio,
  );
});

test('build: sort maxDivLinfL1RatioDesc puts biggest first', () => {
  const r = buildDailyTokenMaxDivergenceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'maxDivLinfL1RatioDesc',
  });
  assert.ok(
    r.sources[0]!.maxDivLinfL1Ratio >= r.sources[1]!.maxDivLinfL1Ratio,
  );
});

test('build: sort tokens orders by total tokens desc', () => {
  const r = buildDailyTokenMaxDivergenceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'tokens',
  });
  assert.ok(r.sources[0]!.totalTokens >= r.sources[1]!.totalTokens);
});

test('build: sort tenure orders by tenure desc', () => {
  const r = buildDailyTokenMaxDivergenceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'tenure',
  });
  assert.ok(r.sources[0]!.nTenureDays >= r.sources[1]!.nTenureDays);
});

test('build: sort source orders alphabetically', () => {
  const r = buildDailyTokenMaxDivergenceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.equal(r.sources[1]!.source, 'src-b');
});

// ---------- builder: filtering & dropping ----------

test('build: drops sparse sources below minTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'tiny', 1));
  const r = buildDailyTokenMaxDivergenceHalves(q, { minTokens: 1000 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: drops below-min-tenure sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) q.push(ql(dayIso(i), 'short', 5000));
  const r = buildDailyTokenMaxDivergenceHalves(q, {
    minTokens: 0,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: drops zero-variance sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'flat', 100));
  const r = buildDailyTokenMaxDivergenceHalves(q, { minTokens: 0 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: counts droppedNonPositiveTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'mixed', 100 + i));
  q.push(ql(dayIso(20), 'mixed', 0));
  q.push(ql(dayIso(21), 'mixed', -5));
  const r = buildDailyTokenMaxDivergenceHalves(q, { minTokens: 0 });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: counts droppedInvalidHourStart', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'a', 100 + i));
  q.push(ql('not-a-date', 'a', 100));
  const r = buildDailyTokenMaxDivergenceHalves(q, { minTokens: 0 });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: source filter restricts and counts droppedSourceFilter', () => {
  const r = buildDailyTokenMaxDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, source: 'src-a' },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: top cap reports droppedTopSources', () => {
  const r = buildDailyTokenMaxDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, top: 1 },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 1);
});

test('build: empty queue returns empty report', () => {
  const r = buildDailyTokenMaxDivergenceHalves([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.totalSources, 0);
});

test('build: respects since window', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenMaxDivergenceHalves(q, {
    minTokens: 0,
    since: '2030-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
});

test('build: respects until window', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenMaxDivergenceHalves(q, {
    minTokens: 0,
    until: '2020-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
});

test('build: gap-fills missing days with zero', () => {
  const q: QueueLine[] = [];
  // active days 0, 5, 10, 15 only — tenure spans 16 days
  for (const i of [0, 5, 10, 15]) q.push(ql(dayIso(i), 'sparse', 1000));
  const r = buildDailyTokenMaxDivergenceHalves(q, {
    minTokens: 0,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nActiveDays, 4);
  assert.equal(r.sources[0]!.nTenureDays, 16);
});

test('build: row fields reflect primitive output', () => {
  const r = buildDailyTokenMaxDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  for (const row of r.sources) {
    assert.ok(row.maxDiv >= 0 && row.maxDiv <= 1);
    assert.ok(row.tvDist >= 0 && row.tvDist <= 1 + 1e-12);
    assert.ok(row.maxDiv <= 2 * row.tvDist + 1e-9);
    assert.ok(Number.isInteger(row.argMaxBucketIndex));
    assert.ok(row.argMaxBucketIndex >= 0);
    assert.ok(row.argMaxBucketIndex < MAXDIV_GRID_K);
    assert.equal(row.maxDivGridK, MAXDIV_GRID_K);
    assert.equal(row.maxDivN1, Math.floor(row.nTenureDays / 2));
    assert.equal(row.maxDivN2, row.nTenureDays - row.maxDivN1);
  }
});

test('build: report metadata round-trips options', () => {
  const r = buildDailyTokenMaxDivergenceHalves(
    makeQueueWithTwoSources(),
    {
      minTokens: 50,
      minTenureDays: 14,
      top: 5,
      sort: 'maxDiv',
      since: '2026-01-01T00:00:00.000Z',
    },
  );
  assert.equal(r.minTokens, 50);
  assert.equal(r.minTenureDays, 14);
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'maxDiv');
  assert.equal(r.windowStart, '2026-01-01T00:00:00.000Z');
});

test('build: generatedAt is propagated', () => {
  const r = buildDailyTokenMaxDivergenceHalves([], {
    generatedAt: '2026-05-03T10:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2026-05-03T10:00:00.000Z');
});

test('build: missing source falls back to (unknown)', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1)
    q.push(ql(dayIso(i), '', 100 + (i % 5) * 10));
  const r = buildDailyTokenMaxDivergenceHalves(q, { minTokens: 0 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('build: totalTokens sums kept rows', () => {
  const r = buildDailyTokenMaxDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  let s = 0;
  for (const row of r.sources) s += row.totalTokens;
  assert.equal(r.totalTokens, s);
});

test('build: totalSources counts all aggregated sources before filters', () => {
  const r = buildDailyTokenMaxDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 1e15 }, // filter out all
  );
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 0);
});

test('build: ties break by source name asc', () => {
  // Two sources with identical pattern -> identical maxDiv.
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    const v = i < 10 ? 100 : 1000;
    q.push(ql(dayIso(i), 'b-src', v + (i % 3)));
    q.push(ql(dayIso(i), 'a-src', v + (i % 3)));
  }
  const r = buildDailyTokenMaxDivergenceHalves(q, {
    minTokens: 0,
    sort: 'maxDiv',
  });
  assert.equal(r.sources[0]!.source, 'a-src');
  assert.equal(r.sources[1]!.source, 'b-src');
});

test('build: top=0 means no cap', () => {
  const r = buildDailyTokenMaxDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, top: 0 },
  );
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 0);
});

test('build: source filter that matches no row drops everything', () => {
  const r = buildDailyTokenMaxDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, source: 'nope' },
  );
  assert.equal(r.sources.length, 0);
});
