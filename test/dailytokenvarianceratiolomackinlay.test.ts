import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenVarianceRatioLoMacKinlay,
  buildDailyTokenVarianceRatioLoMacKinlay,
} from '../src/dailytokenvarianceratiolomackinlay.js';
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

test('dailyTokenVarianceRatioLoMacKinlay: rejects fewer than 6 samples', () => {
  assert.throws(
    () => dailyTokenVarianceRatioLoMacKinlay([1, 2, 3, 4, 5]),
    /at least 6 samples/,
  );
});

test('dailyTokenVarianceRatioLoMacKinlay: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenVarianceRatioLoMacKinlay([1, 2, NaN, 4, 5, 6]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenVarianceRatioLoMacKinlay([1, Infinity, 3, 4, 5, 6]),
    /finite values/,
  );
});

test('dailyTokenVarianceRatioLoMacKinlay: rejects q < 2', () => {
  assert.throws(
    () => dailyTokenVarianceRatioLoMacKinlay([1, 2, 3, 4, 5, 6, 7, 8], 1),
    /q must be an integer >= 2/,
  );
  assert.throws(
    () => dailyTokenVarianceRatioLoMacKinlay([1, 2, 3, 4, 5, 6, 7, 8], 0),
    /q must be an integer >= 2/,
  );
  assert.throws(
    () => dailyTokenVarianceRatioLoMacKinlay([1, 2, 3, 4, 5, 6, 7, 8], 2.5),
    /q must be an integer >= 2/,
  );
});

test('dailyTokenVarianceRatioLoMacKinlay: zero centred variance in differences throws', () => {
  // Constant series => all diffs == 0
  assert.throws(
    () => dailyTokenVarianceRatioLoMacKinlay([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
  // Strictly monotone => all diffs == 1, also zero variance
  assert.throws(
    () => dailyTokenVarianceRatioLoMacKinlay([1, 2, 3, 4, 5, 6, 7, 8]),
    /zero centred variance/,
  );
});

test('dailyTokenVarianceRatioLoMacKinlay: alternating series has VR(2) close to 0 (anti-persistent)', () => {
  // 1, 2, 1, 2, ... => diffs alternate +1, -1; rho_d(1) = -1.
  // VR(2) = 1 + 2 * (1/2) * (-1) = 0 in the limit.
  const x = Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? 1 : 2));
  const r = dailyTokenVarianceRatioLoMacKinlay(x, 2);
  assert.ok(r.vr < 0.1, `expected VR much less than 1, got ${r.vr}`);
  assert.ok(r.vrZIid < -2, `expected vrZIid much less than 0, got ${r.vrZIid}`);
  assert.ok(r.vrZHc < -1, `expected vrZHc much less than 0, got ${r.vrZHc}`);
  assert.equal(r.vrQ, 2);
  assert.equal(r.nDiff, 31);
});

test('dailyTokenVarianceRatioLoMacKinlay: scale invariance vr(a*x) === vr(x)', () => {
  const x = [1, 3, 2, 7, 4, 9, 5, 11, 6, 13, 8, 15];
  const r1 = dailyTokenVarianceRatioLoMacKinlay(x, 2);
  const r2 = dailyTokenVarianceRatioLoMacKinlay(
    x.map((v) => v * 17.5),
    2,
  );
  assert.ok(Math.abs(r1.vr - r2.vr) < 1e-9);
  assert.ok(Math.abs(r1.vrZIid - r2.vrZIid) < 1e-9);
  assert.ok(Math.abs(r1.vrZHc - r2.vrZHc) < 1e-9);
});

test('dailyTokenVarianceRatioLoMacKinlay: shift invariance vr(x + c) === vr(x)', () => {
  const x = [1, 3, 2, 7, 4, 9, 5, 11, 6, 13, 8, 15];
  const r1 = dailyTokenVarianceRatioLoMacKinlay(x, 2);
  const r2 = dailyTokenVarianceRatioLoMacKinlay(
    x.map((v) => v + 1000),
    2,
  );
  assert.ok(Math.abs(r1.vr - r2.vr) < 1e-9);
  assert.ok(Math.abs(r1.vrZIid - r2.vrZIid) < 1e-9);
});

test('dailyTokenVarianceRatioLoMacKinlay: q is capped at floor(nDiff/2)', () => {
  // n = 8 => nDiff = 7 => floor(7/2) = 3
  // Use a non-degenerate series
  const x = [1, 3, 2, 7, 4, 9, 5, 11];
  const r = dailyTokenVarianceRatioLoMacKinlay(x, 100);
  assert.equal(r.vrQ, 3);
});

test('dailyTokenVarianceRatioLoMacKinlay: random-walk-like series has VR(2) ~ 1', () => {
  // Pseudo-iid increments via deterministic LCG
  let s = 1234567;
  const next = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff - 0.5;
  };
  const n = 600;
  const x: number[] = [0];
  for (let i = 1; i < n; i += 1) x.push(x[i - 1]! + next());
  const r = dailyTokenVarianceRatioLoMacKinlay(x, 2);
  // For an iid random walk VR(2) should be close to 1 with vrZ within +/- 3
  assert.ok(Math.abs(r.vr - 1) < 0.25, `VR not close to 1: ${r.vr}`);
  assert.ok(Math.abs(r.vrZIid) < 4, `vrZIid not within +/- 4: ${r.vrZIid}`);
});

// ---------- builder ----------

test('buildDailyTokenVarianceRatioLoMacKinlay: empty queue', () => {
  const r = buildDailyTokenVarianceRatioLoMacKinlay([], { generatedAt: 'X' });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.q, 2);
  assert.equal(r.minTenureDays, 14);
});

test('buildDailyTokenVarianceRatioLoMacKinlay: rejects bad min-tenure-days', () => {
  assert.throws(
    () =>
      buildDailyTokenVarianceRatioLoMacKinlay([], { minTenureDays: 4 }),
    /minTenureDays must be an integer >= 6/,
  );
});

test('buildDailyTokenVarianceRatioLoMacKinlay: rejects bad q', () => {
  assert.throws(
    () => buildDailyTokenVarianceRatioLoMacKinlay([], { q: 1 }),
    /q must be an integer >= 2/,
  );
});

test('buildDailyTokenVarianceRatioLoMacKinlay: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenVarianceRatioLoMacKinlay([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenVarianceRatioLoMacKinlay: alternating series source -> negative vrZ', () => {
  const queue: QueueLine[] = [];
  // 16 days alternating tokens to keep nTenureDays >= 14
  for (let i = 0; i < 16; i += 1) {
    queue.push(
      ql(dayIso(i), 'src-alt', i % 2 === 0 ? 1000 : 5000),
    );
  }
  const r = buildDailyTokenVarianceRatioLoMacKinlay(queue, {
    generatedAt: 'fixed',
    minTenureDays: 14,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src-alt');
  assert.ok(row.vr < 0.5, `expected vr much less than 1, got ${row.vr}`);
  assert.ok(row.vrZIid < -1, `expected vrZIid negative, got ${row.vrZIid}`);
  assert.equal(row.nTenureDays, 16);
  assert.equal(row.nDiff, 15);
});

test('buildDailyTokenVarianceRatioLoMacKinlay: drops sources with constant gap-filled series', () => {
  const queue: QueueLine[] = [];
  // 16 identical days -> constant series -> zero variance after gap-fill
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-const', 2000));
  }
  const r = buildDailyTokenVarianceRatioLoMacKinlay(queue, {
    generatedAt: 'fixed',
    minTenureDays: 14,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenVarianceRatioLoMacKinlay: source filter and sparse drops surface in counts', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'keep', 1000 + (i % 3) * 500));
    queue.push(ql(dayIso(i), 'skip-me', 9000));
  }
  const r = buildDailyTokenVarianceRatioLoMacKinlay(queue, {
    generatedAt: 'fixed',
    source: 'keep',
    minTenureDays: 14,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenVarianceRatioLoMacKinlay: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let i = 0; i < 16; i += 1) {
      // Slight variation so all sources are non-degenerate
      queue.push(
        ql(dayIso(i), `src-${s}`, 1000 + ((i + s) % 5) * 250),
      );
    }
  }
  const r = buildDailyTokenVarianceRatioLoMacKinlay(queue, {
    generatedAt: 'fixed',
    top: 2,
    minTenureDays: 14,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});
