import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenLjungBoxQTest,
  buildDailyTokenLjungBoxQTest,
} from '../src/dailytokenljungboxqtest.js';
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

// ---------- primitive ----------

test('dailyTokenLjungBoxQTest: rejects fewer than 4 samples', () => {
  assert.throws(
    () => dailyTokenLjungBoxQTest([1, 2, 3]),
    /at least 4 samples/,
  );
});

test('dailyTokenLjungBoxQTest: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenLjungBoxQTest([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenLjungBoxQTest([1, Infinity, 3, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenLjungBoxQTest([1, 2, 3, -Infinity]),
    /finite values/,
  );
});

test('dailyTokenLjungBoxQTest: rejects non-positive maxLag', () => {
  assert.throws(
    () => dailyTokenLjungBoxQTest([1, 2, 3, 4], 0),
    /maxLag must be a positive integer/,
  );
  assert.throws(
    () => dailyTokenLjungBoxQTest([1, 2, 3, 4], -1),
    /maxLag must be a positive integer/,
  );
  assert.throws(
    () => dailyTokenLjungBoxQTest([1, 2, 3, 4], 1.5),
    /maxLag must be a positive integer/,
  );
});

test('dailyTokenLjungBoxQTest: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenLjungBoxQTest([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

test('dailyTokenLjungBoxQTest: monotone-increasing has all-positive acf and lbZ much greater than 0', () => {
  const r = dailyTokenLjungBoxQTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  // Effective H = min(10, floor(16/4)) = 4
  assert.equal(r.lbH, 4);
  assert.equal(r.lbDf, 4);
  // All r_k > 0 for monotone-increasing
  for (const r_k of r.lbAcf) {
    assert.ok(r_k > 0, `expected positive acf, got ${r_k}`);
  }
  // r_1 should be the largest (smoothly decaying)
  assert.ok(r.lbAcf[0]! > r.lbAcf[1]!);
  assert.ok(r.lbAcf[1]! > r.lbAcf[2]!);
  // lbQ must be much greater than H for trend
  assert.ok(r.lbQ > r.lbH * 3);
  // lbZ much greater than 0
  assert.ok(r.lbZ > 2);
});

test('dailyTokenLjungBoxQTest: monotone-decreasing yields same lbQ as monotone-increasing (squared acf)', () => {
  const up = dailyTokenLjungBoxQTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const down = dailyTokenLjungBoxQTest([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  // Reversal flips no signs of acf since acf is symmetric in centred values
  assert.ok(Math.abs(up.lbQ - down.lbQ) < 1e-9);
  assert.ok(Math.abs(up.lbZ - down.lbZ) < 1e-9);
});

test('dailyTokenLjungBoxQTest: alternating series has r_1 strongly negative and r_2 strongly positive', () => {
  // 1, 2, 1, 2, ... with n = 16
  const x = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 1 : 2));
  const r = dailyTokenLjungBoxQTest(x);
  assert.ok(r.lbAcf[0]! < -0.5, `expected r_1 << 0, got ${r.lbAcf[0]}`);
  assert.ok(r.lbAcf[1]! > 0.5, `expected r_2 >> 0, got ${r.lbAcf[1]}`);
  // Squared acf large -> Q large -> Z large positive
  assert.ok(r.lbZ > 2);
});

test('dailyTokenLjungBoxQTest: H is capped at floor(n/4)', () => {
  // n = 12, floor(12/4) = 3
  const r = dailyTokenLjungBoxQTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 10);
  assert.equal(r.lbH, 3);
  assert.equal(r.lbAcf.length, 3);
});

test('dailyTokenLjungBoxQTest: H is capped at maxLag when smaller than floor(n/4)', () => {
  // n = 100, floor(100/4) = 25; maxLag = 5 -> H = 5
  const x = Array.from({ length: 100 }, (_, i) => Math.sin(i / 5) + i * 0.01);
  const r = dailyTokenLjungBoxQTest(x, 5);
  assert.equal(r.lbH, 5);
  assert.equal(r.lbAcf.length, 5);
});

test('dailyTokenLjungBoxQTest: shifting series by a constant does not change Q or Z', () => {
  const a = dailyTokenLjungBoxQTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const b = dailyTokenLjungBoxQTest([
    1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015, 1016,
  ]);
  assert.ok(Math.abs(a.lbQ - b.lbQ) < 1e-6);
  assert.ok(Math.abs(a.lbZ - b.lbZ) < 1e-6);
  for (let k = 0; k < a.lbAcf.length; k += 1) {
    assert.ok(Math.abs(a.lbAcf[k]! - b.lbAcf[k]!) < 1e-9);
  }
});

test('dailyTokenLjungBoxQTest: scaling series by a positive constant does not change Q or Z', () => {
  const a = dailyTokenLjungBoxQTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const b = dailyTokenLjungBoxQTest([
    100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600,
  ]);
  assert.ok(Math.abs(a.lbQ - b.lbQ) < 1e-6);
  assert.ok(Math.abs(a.lbZ - b.lbZ) < 1e-6);
});

test('dailyTokenLjungBoxQTest: r_k closed form for monotone n=8 (manual check at k=1)', () => {
  // x = 1..8, xbar = 4.5, centred = -3.5,-2.5,..,3.5; sum sq = 42.
  // r_1 numerator = sum_{t=0..6} c[t] c[t+1]
  //   = (-3.5)(-2.5) + (-2.5)(-1.5) + (-1.5)(-0.5) + (-0.5)(0.5) + (0.5)(1.5) + (1.5)(2.5) + (2.5)(3.5)
  //   = 8.75 + 3.75 + 0.75 - 0.25 + 0.75 + 3.75 + 8.75 = 26.25
  // r_1 = 26.25 / 42 = 0.625
  const r = dailyTokenLjungBoxQTest([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(Math.abs(r.lbAcf[0]! - 0.625) < 1e-9);
});

test('dailyTokenLjungBoxQTest: lbQ closed form for monotone n=8 (manual)', () => {
  // n=8, floor(8/4)=2, H=2
  // r_1 = 0.625 (above)
  // r_2 numerator = (-3.5)(-1.5) + (-2.5)(-0.5) + (-1.5)(0.5) + (-0.5)(1.5) + (0.5)(2.5) + (1.5)(3.5)
  //   = 5.25 + 1.25 - 0.75 - 0.75 + 1.25 + 5.25 = 11.5
  // r_2 = 11.5 / 42 = 0.27380952...
  // weighted = r_1^2 / 7 + r_2^2 / 6 = 0.390625/7 + 0.074957..../6
  //   = 0.0558035... + 0.012493... = 0.068296...
  // Q = 8 * 10 * weighted = 80 * 0.068296... = 5.4637...
  const r = dailyTokenLjungBoxQTest([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.lbH, 2);
  const r1 = 0.625;
  const r2 = 11.5 / 42;
  const expectedQ = 8 * 10 * ((r1 * r1) / 7 + (r2 * r2) / 6);
  assert.ok(Math.abs(r.lbQ - expectedQ) < 1e-9);
  const expectedZ = (expectedQ - 2) / Math.sqrt(4);
  assert.ok(Math.abs(r.lbZ - expectedZ) < 1e-9);
});

test('dailyTokenLjungBoxQTest: small-noise iid-like series has lbZ near 0', () => {
  // Pseudo-random Park-Miller LCG seeded; generate length-100 small-amp series
  let seed = 12345;
  const x: number[] = [];
  for (let i = 0; i < 100; i += 1) {
    seed = (seed * 16807) % 2147483647;
    x.push(seed / 2147483647);
  }
  const r = dailyTokenLjungBoxQTest(x, 10);
  assert.equal(r.lbH, 10);
  // For genuinely iid-like sequence, |lbZ| should be modest (< 3).
  assert.ok(Math.abs(r.lbZ) < 3, `expected |lbZ| < 3 for iid-like, got ${r.lbZ}`);
});

test('dailyTokenLjungBoxQTest: result mean and stddev match population estimates', () => {
  const x = [10, 20, 30, 40, 50, 60, 70, 80];
  const r = dailyTokenLjungBoxQTest(x);
  const expectedMean = 45;
  const expectedVar =
    x.reduce((acc, v) => acc + (v - expectedMean) ** 2, 0) / x.length;
  const expectedStd = Math.sqrt(expectedVar);
  assert.ok(Math.abs(r.mean - expectedMean) < 1e-9);
  assert.ok(Math.abs(r.stddev - expectedStd) < 1e-9);
  assert.equal(r.nSamples, 8);
});

test('dailyTokenLjungBoxQTest: nSamples reflects input length', () => {
  const r = dailyTokenLjungBoxQTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.equal(r.nSamples, 20);
  assert.equal(r.lbH, 5); // floor(20/4) = 5
});

test('dailyTokenLjungBoxQTest: accepts maxLag = 1 (only r_1 enters)', () => {
  const r = dailyTokenLjungBoxQTest([1, 2, 3, 4, 5, 6, 7, 8], 1);
  assert.equal(r.lbH, 1);
  assert.equal(r.lbAcf.length, 1);
  // Q = n(n+2) r_1^2 / (n - 1) = 8*10*0.390625/7 = 4.46428...
  const expectedQ = (8 * 10 * 0.625 * 0.625) / 7;
  assert.ok(Math.abs(r.lbQ - expectedQ) < 1e-9);
});

test('dailyTokenLjungBoxQTest: r_k in [-1, +1] for finite series', () => {
  const x = [1, 5, 2, 8, 3, 9, 1, 7, 4, 6, 2, 8, 1, 9, 3, 7];
  const r = dailyTokenLjungBoxQTest(x);
  for (const r_k of r.lbAcf) {
    assert.ok(r_k >= -1 && r_k <= 1, `r_k out of [-1,1]: ${r_k}`);
  }
});

test('dailyTokenLjungBoxQTest: lbDf equals lbH', () => {
  const r1 = dailyTokenLjungBoxQTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(r1.lbDf, r1.lbH);
  const r2 = dailyTokenLjungBoxQTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.equal(r2.lbDf, r2.lbH);
});

test('dailyTokenLjungBoxQTest: small n=4 yields H=1', () => {
  const r = dailyTokenLjungBoxQTest([1, 2, 3, 4]);
  assert.equal(r.lbH, 1);
  // r_1 numerator = (-1.5)(-0.5) + (-0.5)(0.5) + (0.5)(1.5) = 0.75 - 0.25 + 0.75 = 1.25
  // sum sq = 2.25 + 0.25 + 0.25 + 2.25 = 5.0
  // r_1 = 0.25
  assert.ok(Math.abs(r.lbAcf[0]! - 0.25) < 1e-9);
});

// ---------- builder ----------

test('buildDailyTokenLjungBoxQTest: empty queue -> zero rows', () => {
  const r = buildDailyTokenLjungBoxQTest([], { generatedAt: '2026-05-03T00:00:00.000Z' });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
});

test('buildDailyTokenLjungBoxQTest: rejects bad minTokens', () => {
  assert.throws(
    () => buildDailyTokenLjungBoxQTest([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
  assert.throws(
    () => buildDailyTokenLjungBoxQTest([], { minTokens: NaN }),
    /minTokens must be a non-negative finite number/,
  );
});

test('buildDailyTokenLjungBoxQTest: rejects bad minTenureDays', () => {
  assert.throws(
    () => buildDailyTokenLjungBoxQTest([], { minTenureDays: 3 }),
    /minTenureDays must be an integer >= 4/,
  );
  assert.throws(
    () => buildDailyTokenLjungBoxQTest([], { minTenureDays: 1.5 }),
    /minTenureDays must be an integer >= 4/,
  );
});

test('buildDailyTokenLjungBoxQTest: rejects bad maxLag', () => {
  assert.throws(
    () => buildDailyTokenLjungBoxQTest([], { maxLag: 0 }),
    /maxLag must be a positive integer/,
  );
  assert.throws(
    () => buildDailyTokenLjungBoxQTest([], { maxLag: -3 }),
    /maxLag must be a positive integer/,
  );
});

test('buildDailyTokenLjungBoxQTest: rejects bad top', () => {
  assert.throws(
    () => buildDailyTokenLjungBoxQTest([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('buildDailyTokenLjungBoxQTest: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenLjungBoxQTest([], {
        sort: 'nonsense' as unknown as 'q',
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenLjungBoxQTest: invalid since throws', () => {
  assert.throws(
    () => buildDailyTokenLjungBoxQTest([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('buildDailyTokenLjungBoxQTest: invalid until throws', () => {
  assert.throws(
    () => buildDailyTokenLjungBoxQTest([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('buildDailyTokenLjungBoxQTest: bad hour_start increments droppedInvalidHourStart', () => {
  const queue = [ql('not-a-date', 'a', 5000)];
  const r = buildDailyTokenLjungBoxQTest(queue, { generatedAt: '2026-05-03T00:00:00.000Z' });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenLjungBoxQTest: non-positive tokens dropped', () => {
  const queue = [ql(dayIso(0), 'a', 0), ql(dayIso(1), 'a', -10)];
  const r = buildDailyTokenLjungBoxQTest(queue, { generatedAt: '2026-05-03T00:00:00.000Z' });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenLjungBoxQTest: source filter excludes non-matching rows', () => {
  const queue = [ql(dayIso(0), 'a', 5000), ql(dayIso(1), 'b', 5000)];
  const r = buildDailyTokenLjungBoxQTest(queue, {
    source: 'a',
    minTokens: 1,
    minTenureDays: 4,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedSourceFilter, 1);
});

test('buildDailyTokenLjungBoxQTest: below min-tokens dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'sparse', 10));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenLjungBoxQTest: below min-tenure-days dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'short', 5000));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenLjungBoxQTest: zero-variance series dropped', () => {
  // 14-day tenure, all same value -> mn === mx -> dropped
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 1000));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenLjungBoxQTest: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 3; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), `s${s}`, 1000 + i + s * 100));
    }
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    top: 1,
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenLjungBoxQTest: deterministic on identical inputs', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'd', 1000 + i * 50));
  }
  const a = buildDailyTokenLjungBoxQTest(queue, { generatedAt: '2026-05-03T00:00:00.000Z' });
  const b = buildDailyTokenLjungBoxQTest(queue, { generatedAt: '2026-05-03T00:00:00.000Z' });
  assert.deepEqual(a, b);
});

test('buildDailyTokenLjungBoxQTest: monotone series produces lbZ much greater than 0', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'mono', 1000 + i * 100));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.lbZ > 2);
});

test('buildDailyTokenLjungBoxQTest: alternating series produces lbZ much greater than 0', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'alt', i % 2 === 0 ? 1000 : 5000));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  // Alternating -> r_1 << 0, r_2 >> 0 -> Q very large
  assert.ok(r.sources[0]!.lbZ > 5);
});

test('buildDailyTokenLjungBoxQTest: gap-filled tenure includes zero days between sparse buckets', () => {
  const queue: QueueLine[] = [];
  // Day 0 and day 19 only -> tenure = 20 days, 18 zero-fill days between.
  queue.push(ql(dayIso(0), 'g', 5000));
  queue.push(ql(dayIso(19), 'g', 5000));
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 20);
  assert.equal(r.sources[0]!.nActiveDays, 2);
});

test('buildDailyTokenLjungBoxQTest: missing source becomes (unknown)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), '', 1000 + i * 50));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('buildDailyTokenLjungBoxQTest: sort=lbZAbsDesc puts strongest evidence first', () => {
  const queue: QueueLine[] = [];
  // Source 'mono': strong trend
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'mono', 1000 + i * 100));
  }
  // Source 'noisy': iid-ish small noise on top of mean
  let seed = 7;
  for (let i = 0; i < 20; i += 1) {
    seed = (seed * 16807) % 2147483647;
    const noise = Math.floor((seed / 2147483647) * 100);
    queue.push(ql(dayIso(i), 'noisy', 5000 + noise));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    sort: 'lbZAbsDesc',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  // Strongest evidence (mono) should come first
  assert.equal(r.sources[0]!.source, 'mono');
});

test('buildDailyTokenLjungBoxQTest: sort=tenure puts longest-tenure first', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'short', 1000 + i * 50));
  }
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'long', 1000 + i * 50));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    sort: 'tenure',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'long');
});

test('buildDailyTokenLjungBoxQTest: sort=tokens puts highest-tokens first', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'low', 100 + i * 10));
  }
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'high', 10000 + i * 100));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    sort: 'tokens',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'high');
});

test('buildDailyTokenLjungBoxQTest: sort=source falls back to alphabetical', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'zebra', 1000 + i * 50));
  }
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'apple', 1000 + i * 50));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    sort: 'source',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'apple');
  assert.equal(r.sources[1]!.source, 'zebra');
});

test('buildDailyTokenLjungBoxQTest: sort=q ascending puts smallest Q first', () => {
  const queue: QueueLine[] = [];
  // Source A: iid-ish
  let seed = 11;
  for (let i = 0; i < 20; i += 1) {
    seed = (seed * 16807) % 2147483647;
    queue.push(ql(dayIso(i), 'iid', 5000 + Math.floor((seed / 2147483647) * 100)));
  }
  // Source B: trend
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'trend', 1000 + i * 200));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    sort: 'q',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  // Smallest Q should be the iid-ish one
  assert.ok(r.sources[0]!.lbQ <= r.sources[1]!.lbQ);
});

test('buildDailyTokenLjungBoxQTest: sort=lbZ ascending puts smallest (most negative) lbZ first', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'a', 1000 + i * 100));
  }
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'b', 1000 + (19 - i) * 100));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    sort: 'lbZ',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  // ascending lbZ; ties by alpha
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.lbZ <= r.sources[1]!.lbZ);
});

test('buildDailyTokenLjungBoxQTest: window since/until restricts buckets', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'w', 1000 + i * 100));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    since: dayIso(5),
    until: dayIso(20),
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  // [5, 20) -> 15 days, tenure = 15
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 15);
});

test('buildDailyTokenLjungBoxQTest: lbAcf has length lbH', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'long', 1000 + i * 100));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    maxLag: 10,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.lbH, 10);
  assert.equal(r.sources[0]!.lbAcf.length, 10);
});

test('buildDailyTokenLjungBoxQTest: short tenure caps lbH at floor(n/4)', () => {
  const queue: QueueLine[] = [];
  // 16-day tenure -> floor(16/4) = 4
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'sh', 1000 + i * 100));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    maxLag: 10,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.lbH, 4);
  assert.equal(r.sources[0]!.lbAcf.length, 4);
});

test('buildDailyTokenLjungBoxQTest: rows surface mean and stddev consistent with primitive', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'm', 1000 + i * 100));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  const expectedMean =
    Array.from({ length: 20 }, (_, i) => 1000 + i * 100).reduce((a, b) => a + b, 0) / 20;
  assert.ok(Math.abs(r.sources[0]!.mean - expectedMean) < 1e-9);
});

test('buildDailyTokenLjungBoxQTest: report carries through generatedAt and config', () => {
  const r = buildDailyTokenLjungBoxQTest([], {
    generatedAt: '2026-05-03T12:34:56.000Z',
    minTokens: 500,
    minTenureDays: 7,
    maxLag: 8,
    sort: 'q',
  });
  assert.equal(r.generatedAt, '2026-05-03T12:34:56.000Z');
  assert.equal(r.minTokens, 500);
  assert.equal(r.minTenureDays, 7);
  assert.equal(r.maxLag, 8);
  assert.equal(r.sort, 'q');
});

test('buildDailyTokenLjungBoxQTest: hours within same day collapse into one daily bucket', () => {
  const queue: QueueLine[] = [];
  // Day 0: two hours; day 1..19: one each
  queue.push({ hour_start: '2026-01-01T00:00:00.000Z', source: 'h', total_tokens: 1000 } as unknown as QueueLine);
  queue.push({ hour_start: '2026-01-01T12:00:00.000Z', source: 'h', total_tokens: 2000 } as unknown as QueueLine);
  for (let i = 1; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'h', 1000 + i * 50));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nActiveDays, 20);
  assert.equal(r.sources[0]!.nTenureDays, 20);
});

test('buildDailyTokenLjungBoxQTest: lbAcf entries are finite for valid input', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    queue.push(ql(dayIso(i), 'f', 1000 + Math.floor(Math.sin(i) * 500) + i * 30));
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  for (const r_k of r.sources[0]!.lbAcf) {
    assert.ok(Number.isFinite(r_k));
  }
  assert.ok(Number.isFinite(r.sources[0]!.lbQ));
  assert.ok(Number.isFinite(r.sources[0]!.lbZ));
});

test('buildDailyTokenLjungBoxQTest: top=0 means no cap', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), `s${s}`, 1000 + i + s * 50));
    }
  }
  const r = buildDailyTokenLjungBoxQTest(queue, {
    minTokens: 1,
    minTenureDays: 14,
    top: 0,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 5);
  assert.equal(r.droppedTopSources, 0);
});

// ---------- exact-identity property anchors ----------

test('dailyTokenLjungBoxQTest: time-reversal invariance lbQ(reverse(x)) === lbQ(x)', () => {
  const x = [3, 7, 1, 9, 2, 8, 4, 6, 5, 10, 0, 11, 12, 1, 8, 3];
  const reversed = x.slice().reverse();
  const a = dailyTokenLjungBoxQTest(x);
  const b = dailyTokenLjungBoxQTest(reversed);
  assert.ok(Math.abs(a.lbQ - b.lbQ) < 1e-9, `lbQ mismatch: ${a.lbQ} vs ${b.lbQ}`);
  assert.ok(Math.abs(a.lbZ - b.lbZ) < 1e-9);
  for (let k = 0; k < a.lbAcf.length; k += 1) {
    assert.ok(
      Math.abs(a.lbAcf[k]! - b.lbAcf[k]!) < 1e-9,
      `lbAcf[${k}] mismatch: ${a.lbAcf[k]} vs ${b.lbAcf[k]}`,
    );
  }
});

test('dailyTokenLjungBoxQTest: lbAcf[k] always in [-1, +1] (Cauchy-Schwarz)', () => {
  // Stress with various non-trivial inputs
  const inputs: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
    Array.from({ length: 30 }, (_, i) => Math.sin(i / 3)),
    Array.from({ length: 50 }, (_, i) => (i * 7919) % 173),
  ];
  for (const x of inputs) {
    const r = dailyTokenLjungBoxQTest(x);
    for (const r_k of r.lbAcf) {
      assert.ok(
        r_k >= -1 - 1e-12 && r_k <= 1 + 1e-12,
        `acf out of [-1,1]: ${r_k}`,
      );
    }
  }
});

test('dailyTokenLjungBoxQTest: positive-scalar invariance lbQ(a*x) === lbQ(x)', () => {
  const x = [1, 4, 2, 7, 3, 9, 5, 11, 6, 8, 4, 10, 12, 7, 13, 9];
  const a = dailyTokenLjungBoxQTest(x);
  const scaled = x.map((v) => v * 7.5);
  const b = dailyTokenLjungBoxQTest(scaled);
  // r_k is scale-invariant by the ratio definition (numerator and
  // denominator both pick up a^2). lbQ and lbZ inherit the invariance.
  assert.ok(Math.abs(a.lbQ - b.lbQ) < 1e-6, `lbQ mismatch: ${a.lbQ} vs ${b.lbQ}`);
  assert.ok(Math.abs(a.lbZ - b.lbZ) < 1e-6);
  for (let k = 0; k < a.lbAcf.length; k += 1) {
    assert.ok(Math.abs(a.lbAcf[k]! - b.lbAcf[k]!) < 1e-9);
  }
});
