import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenTukeyQuickHalves,
  buildDailyTokenTukeyQuickHalves,
} from '../src/dailytokentukeyquickhalves.js';
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

// ---------- core: Tukey quick test ----------

test('dailyTokenTukeyQuickHalves: rejects too few samples', () => {
  assert.throws(
    () => dailyTokenTukeyQuickHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenTukeyQuickHalves: rejects non-finite values', () => {
  assert.throws(
    () =>
      dailyTokenTukeyQuickHalves([1, 2, 3, 4, 5, 6, 7, NaN]),
    /finite values/,
  );
});

test('dailyTokenTukeyQuickHalves: rejects zero variance', () => {
  assert.throws(
    () => dailyTokenTukeyQuickHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

test('dailyTokenTukeyQuickHalves: clean separated halves give large W', () => {
  // First half all <= 10, second half all >= 100. Every B
  // > maxA = 10 (4 exceedances) and every A < minB = 100
  // (4 exceedances). tqW = 8.
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r = dailyTokenTukeyQuickHalves(v);
  assert.equal(r.tqN1, 4);
  assert.equal(r.tqN2, 4);
  assert.equal(r.tqHi, 4);
  assert.equal(r.tqLo, 4);
  assert.equal(r.tqW, 8);
  assert.equal(r.tqSignedW, +8); // B is "high" -> positive (location ROSE)
  assert.equal(r.tqIndeterminate, false);
  assert.ok(r.tqTwoSidedP < 0.01); // (0.5)^8 + (0.5)^8 = 1/128 ~ 0.0078
});

test('dailyTokenTukeyQuickHalves: signed W direction (location dropped)', () => {
  // First half all >> second half: A = high.
  const v = [100, 200, 300, 400, 1, 2, 3, 4];
  const r = dailyTokenTukeyQuickHalves(v);
  assert.equal(r.tqW, 8);
  assert.equal(r.tqSignedW, -8); // A is "high" -> negative
});

test('dailyTokenTukeyQuickHalves: interleaved halves give W = 0', () => {
  // Sorted pool: 1,2,3,4,5,6,7,8. A = odd ranks {1,3,5,7},
  // B = even ranks {2,4,6,8}. maxA=7, maxB=8 -> B is high
  // but only 1 B-value (the 8) exceeds maxA=7, so hi=1.
  // minA=1, minB=2 -> A is low; only 1 A-value (the 1)
  // is below minB=2, so lo=1. tqW = 2 (smallest non-zero).
  const v = [1, 3, 5, 7, 2, 4, 6, 8];
  const r = dailyTokenTukeyQuickHalves(v);
  assert.equal(r.tqW, 2);
  assert.ok(r.tqW < 7); // not significant at .05
});

test('dailyTokenTukeyQuickHalves: indeterminate (one half envelopes other)', () => {
  // A range = [1, 100] envelopes B range = [10, 50].
  const v = [1, 50, 100, 25, 10, 20, 30, 40];
  const r = dailyTokenTukeyQuickHalves(v);
  assert.equal(r.tqIndeterminate, true);
  assert.equal(r.tqW, 0);
  assert.equal(r.tqSignedW, 0);
  assert.equal(r.tqTwoSidedP, 1);
});

test('dailyTokenTukeyQuickHalves: shift invariance tqW(x+c) === tqW(x)', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r1 = dailyTokenTukeyQuickHalves(v);
  const r2 = dailyTokenTukeyQuickHalves(v.map((x) => x + 1234));
  assert.equal(r1.tqW, r2.tqW);
  assert.equal(r1.tqSignedW, r2.tqSignedW);
});

test('dailyTokenTukeyQuickHalves: positive scale invariance tqW(a*x) === tqW(x)', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r1 = dailyTokenTukeyQuickHalves(v);
  const r2 = dailyTokenTukeyQuickHalves(v.map((x) => 7.5 * x));
  assert.equal(r1.tqW, r2.tqW);
  assert.equal(r1.tqSignedW, r2.tqSignedW);
});

test('dailyTokenTukeyQuickHalves: monotone-increasing transform invariance', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r1 = dailyTokenTukeyQuickHalves(v);
  // log is strictly increasing on positive reals.
  const r2 = dailyTokenTukeyQuickHalves(v.map((x) => Math.log(x)));
  assert.equal(r1.tqW, r2.tqW);
  assert.equal(r1.tqSignedW, r2.tqSignedW);
});

test('dailyTokenTukeyQuickHalves: tied extremes are conservative (strict inequality)', () => {
  // Two halves with the same max and same min -> hi=0, lo=0.
  // But interior values can still resolve: here all interior
  // overlap too, so W=0.
  const v = [1, 5, 5, 10, 1, 5, 5, 10];
  const r = dailyTokenTukeyQuickHalves(v);
  assert.equal(r.tqW, 0);
  assert.equal(r.tqTwoSidedP, 1);
});

test('dailyTokenTukeyQuickHalves: Neave p-value formula matches', () => {
  // n1 = n2 = 4, tqW = 8 -> p = 2 * (0.5)^8 = 2/256 = 0.0078125
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r = dailyTokenTukeyQuickHalves(v);
  assert.ok(Math.abs(r.tqTwoSidedP - 0.0078125) < 1e-9);
});

test('dailyTokenTukeyQuickHalves: odd n splits into floor(n/2) + ceil', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400, 500];
  const r = dailyTokenTukeyQuickHalves(v);
  assert.equal(r.tqN1, 4);
  assert.equal(r.tqN2, 5);
  // All 5 B-values > 4 = maxA; all 4 A-values < 100 = minB.
  assert.equal(r.tqW, 9);
});

// ---------- builder: source pipeline ----------

test('buildDailyTokenTukeyQuickHalves: defaults', () => {
  const lines: QueueLine[] = [];
  // Source 'low-high' with 8 days: first 4 small, last 4 large.
  for (let i = 0; i < 4; i += 1) lines.push(ql(dayIso(i), 'low-high', 1000 + i));
  for (let i = 4; i < 8; i += 1)
    lines.push(ql(dayIso(i), 'low-high', 100000 + i));
  const r = buildDailyTokenTukeyQuickHalves(lines, { minTenureDays: 8 });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'low-high');
  assert.equal(row.tqW, 8);
  assert.equal(row.tqSignedW, +8);
  assert.equal(row.tqIndeterminate, false);
});

test('buildDailyTokenTukeyQuickHalves: rejects bad minTenureDays', () => {
  assert.throws(
    () => buildDailyTokenTukeyQuickHalves([], { minTenureDays: 4 }),
    />= 8/,
  );
});

test('buildDailyTokenTukeyQuickHalves: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenTukeyQuickHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenTukeyQuickHalves: drops zero-variance source', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) lines.push(ql(dayIso(i), 'flat', 1000));
  const r = buildDailyTokenTukeyQuickHalves(lines, { minTenureDays: 8 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenTukeyQuickHalves: drops below min tenure', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) lines.push(ql(dayIso(i), 'short', 1000 + i));
  const r = buildDailyTokenTukeyQuickHalves(lines, { minTenureDays: 8 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenTukeyQuickHalves: source filter', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) lines.push(ql(dayIso(i), 'a', 1000 + i));
  for (let i = 0; i < 8; i += 1)
    lines.push(ql(dayIso(i), 'b', 1000 + i * 7));
  const r = buildDailyTokenTukeyQuickHalves(lines, {
    source: 'a',
    minTenureDays: 8,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 8);
});

test('buildDailyTokenTukeyQuickHalves: top cap', () => {
  const lines: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    for (let i = 0; i < 8; i += 1) lines.push(ql(dayIso(i), s, 1000 + i * 100));
  }
  const r = buildDailyTokenTukeyQuickHalves(lines, {
    minTenureDays: 8,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenTukeyQuickHalves: sort by tqWAbsDesc', () => {
  const lines: QueueLine[] = [];
  // Source 'big-shift': separated halves -> tqW = 8.
  for (let i = 0; i < 4; i += 1)
    lines.push(ql(dayIso(i), 'big-shift', 1000 + i));
  for (let i = 4; i < 8; i += 1)
    lines.push(ql(dayIso(i), 'big-shift', 100000 + i));
  // Source 'small-shift': interleaved -> tqW small.
  const interleaved = [10, 30, 50, 70, 20, 40, 60, 80];
  for (let i = 0; i < 8; i += 1)
    lines.push(ql(dayIso(i), 'small-shift', 1000 * interleaved[i]!));
  const r = buildDailyTokenTukeyQuickHalves(lines, {
    minTenureDays: 8,
    sort: 'tqWAbsDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'big-shift');
  assert.equal(r.sources[1]!.source, 'small-shift');
});

test('buildDailyTokenTukeyQuickHalves: indeterminate row surfaces', () => {
  const lines: QueueLine[] = [];
  // First half [1, 50, 100, 25] envelopes second half [10, 20, 30, 40].
  const v = [1, 50, 100, 25, 10, 20, 30, 40];
  for (let i = 0; i < 8; i += 1) lines.push(ql(dayIso(i), 'env', 1000 * v[i]!));
  const r = buildDailyTokenTukeyQuickHalves(lines, { minTenureDays: 8 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.tqIndeterminate, true);
  assert.equal(r.sources[0]!.tqW, 0);
});
