import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenWilcoxonSignedRankHalves,
  buildDailyTokenWilcoxonSignedRankHalves,
  midRanks,
  wilcoxonSignedRankDecision,
} from '../src/dailytokenwilcoxonsignedrankhalves.js';
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

// ---------- wilcoxonSignedRankDecision ----------

test('wsr: decision highly-significant at .0005', () => {
  assert.equal(wilcoxonSignedRankDecision(0.0005), 'highly-significant');
  assert.equal(wilcoxonSignedRankDecision(0.001), 'highly-significant');
});

test('wsr: decision very-significant at .005', () => {
  assert.equal(wilcoxonSignedRankDecision(0.005), 'very-significant');
  assert.equal(wilcoxonSignedRankDecision(0.01), 'very-significant');
});

test('wsr: decision significant at .03', () => {
  assert.equal(wilcoxonSignedRankDecision(0.03), 'significant');
  assert.equal(wilcoxonSignedRankDecision(0.05), 'significant');
});

test('wsr: decision marginal at .08', () => {
  assert.equal(wilcoxonSignedRankDecision(0.08), 'marginal');
  assert.equal(wilcoxonSignedRankDecision(0.10), 'marginal');
});

test('wsr: decision ns above .10', () => {
  assert.equal(wilcoxonSignedRankDecision(0.11), 'ns');
  assert.equal(wilcoxonSignedRankDecision(0.5), 'ns');
  assert.equal(wilcoxonSignedRankDecision(1.0), 'ns');
});

test('wsr: decision throws on out-of-range', () => {
  assert.throws(() => wilcoxonSignedRankDecision(-0.01), /\[0, 1\]/);
  assert.throws(() => wilcoxonSignedRankDecision(1.01), /\[0, 1\]/);
  assert.throws(() => wilcoxonSignedRankDecision(NaN), /\[0, 1\]/);
});

// ---------- midRanks ----------

test('wsr: midRanks plain ascending integers', () => {
  const { ranks, tieGroupSizes } = midRanks([10, 20, 30, 40]);
  assert.deepEqual(ranks, [1, 2, 3, 4]);
  assert.deepEqual(tieGroupSizes, []);
});

test('wsr: midRanks averages tied values', () => {
  // values [5, 5, 7, 7, 7, 9]; sorted ranks: 5->1.5, 5->1.5, 7->4, 7->4, 7->4, 9->6.
  const { ranks, tieGroupSizes } = midRanks([5, 5, 7, 7, 7, 9]);
  assert.deepEqual(ranks, [1.5, 1.5, 4, 4, 4, 6]);
  assert.deepEqual(tieGroupSizes.sort((a, b) => a - b), [2, 3]);
});

test('wsr: midRanks unsorted input', () => {
  const { ranks } = midRanks([30, 10, 20]);
  assert.deepEqual(ranks, [3, 1, 2]);
});

// ---------- dailyTokenWilcoxonSignedRankHalves ----------

test('wsr: stat throws on n<16', () => {
  assert.throws(
    () => dailyTokenWilcoxonSignedRankHalves([1, 2, 3, 4, 5, 6, 7, 8]),
    /at least 16/,
  );
});

test('wsr: stat throws on non-finite values', () => {
  const v = Array.from({ length: 16 }, (_, i) => (i === 5 ? NaN : i + 1));
  assert.throws(
    () => dailyTokenWilcoxonSignedRankHalves(v),
    /finite values/,
  );
});

test('wsr: large clean positive shift gives positive Z and tiny p', () => {
  // First half ~10, second half ~100. Every paired diff strongly positive.
  const v = [
    8, 12, 9, 11, 10, 13, 7, 14,
    98, 102, 95, 105, 99, 101, 100, 100,
  ];
  const r = dailyTokenWilcoxonSignedRankHalves(v);
  assert.equal(r.nPairs, 8);
  assert.equal(r.nNonZero, 8);
  assert.equal(r.nZeroDropped, 0);
  // All diffs positive => W- = 0, W+ = sum 1..8 = 36.
  assert.equal(r.wMinus, 0);
  assert.equal(r.wPlus, 36);
  assert.ok(r.z > 0);
  assert.ok(r.pTwoSided < 0.05, `expected p<0.05, got ${r.pTwoSided}`);
  assert.equal(r.rankBiserial, 1);
});

test('wsr: large clean negative shift gives negative Z and tiny p', () => {
  const v = [
    98, 102, 95, 105, 99, 101, 100, 100,
    8, 12, 9, 11, 10, 13, 7, 14,
  ];
  const r = dailyTokenWilcoxonSignedRankHalves(v);
  assert.equal(r.wPlus, 0);
  assert.ok(r.wMinus > 0);
  assert.ok(r.z < 0);
  assert.ok(r.pTwoSided < 0.05);
  assert.equal(r.rankBiserial, -1);
});

test('wsr: identical paired halves gives Z near 0 and large p', () => {
  // All d_i = 0 -> Pratt drops them; we need at least 6 non-zero.
  // Use halves that are NEARLY identical in distribution but not pointwise.
  const v = [10, 20, 15, 25, 30, 12, 18, 22, 22, 18, 12, 30, 25, 15, 20, 10];
  const r = dailyTokenWilcoxonSignedRankHalves(v);
  assert.ok(Math.abs(r.z) < 1.5, `expected |z|<1.5, got ${r.z}`);
  assert.ok(r.pTwoSided > 0.10);
});

test('wsr: drops zero-difference pairs Pratt-style', () => {
  // 16-day series; pairs (A_i, B_i) for i in 0..7. Make 2 of them tie.
  // half0=[1,2,3,4,5,6,7,8], half1=[1,2,30,40,50,60,70,80].
  // diffs = [0, 0, 27, 36, 45, 54, 63, 72]; 2 zeros dropped; 6 positive.
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 30, 40, 50, 60, 70, 80];
  const r = dailyTokenWilcoxonSignedRankHalves(v);
  assert.equal(r.nPairs, 8);
  assert.equal(r.nZeroDropped, 2);
  assert.equal(r.nNonZero, 6);
  assert.equal(r.wMinus, 0);
  // ranks of |d_i| over 6 nonzero diffs = 1..6, sum = 21.
  assert.equal(r.wPlus, 21);
  assert.ok(r.z > 0);
});

test('wsr: throws when fewer than 6 non-zero differences after Pratt drop', () => {
  // 16 values; make 7 pairs identical -> only 1 non-zero diff.
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 99];
  assert.throws(
    () => dailyTokenWilcoxonSignedRankHalves(v),
    /at least 6 non-zero/,
  );
});

test('wsr: odd-length input drops median day so halves match', () => {
  // 17 days; median index = 8. Without dropping, halves would be uneven.
  const v = [
    8, 12, 9, 11, 10, 13, 7, 14,
    50, // median day -> dropped
    98, 102, 95, 105, 99, 101, 100, 100,
  ];
  const r = dailyTokenWilcoxonSignedRankHalves(v);
  assert.equal(r.nPairs, 8);
  // Same paired diffs as the n=16 case: all positive, W+ = 36.
  assert.equal(r.wPlus, 36);
  assert.equal(r.wMinus, 0);
});

test('wsr: tie correction reduces variance below the no-tie baseline', () => {
  // 16 days; some |d_i| ties.
  const v = [
    10, 10, 10, 10, 10, 10, 10, 10,
    15, 15, 20, 20, 25, 30, 35, 40,
  ];
  const r = dailyTokenWilcoxonSignedRankHalves(v);
  const N = r.nNonZero;
  const noTieVar = (N * (N + 1) * (2 * N + 1)) / 24;
  assert.ok(
    r.varianceWPlus < noTieVar,
    `tie variance ${r.varianceWPlus} should be < no-tie ${noTieVar}`,
  );
});

test('wsr: rank-biserial r = (W+ - W-) / (W+ + W-)', () => {
  const v = [
    1, 2, 3, 4, 5, 6, 7, 8,
    10, 1, 30, 1, 50, 1, 70, 1,
  ];
  const r = dailyTokenWilcoxonSignedRankHalves(v);
  const denom = r.wPlus + r.wMinus;
  assert.ok(denom > 0);
  const expected = (r.wPlus - r.wMinus) / denom;
  assert.ok(Math.abs(r.rankBiserial - expected) < 1e-12);
  assert.ok(r.rankBiserial >= -1 && r.rankBiserial <= 1);
});

test('wsr: deterministic on identical input', () => {
  const v = [
    8, 12, 9, 11, 10, 13, 7, 14,
    98, 102, 95, 105, 99, 101, 100, 100,
  ];
  const r1 = dailyTokenWilcoxonSignedRankHalves(v);
  const r2 = dailyTokenWilcoxonSignedRankHalves(v);
  assert.equal(r1.z, r2.z);
  assert.equal(r1.pTwoSided, r2.pTwoSided);
  assert.equal(r1.wPlus, r2.wPlus);
});

// ---------- builder ----------

test('wsr: builder drops sparse / short / zero-variance sources', () => {
  const queue: QueueLine[] = [];
  queue.push(ql(dayIso(0), 'sparse', 100));
  for (let i = 0; i < 5; i += 1) queue.push(ql(dayIso(i + 1), 'short', 5000));
  for (let i = 0; i < 16; i += 1) queue.push(ql(dayIso(i + 10), 'flat', 1000));
  const vals = [
    8000, 12000, 9000, 11000, 10000, 13000, 7000, 14000,
    98000, 102000, 95000, 105000, 99000, 101000, 100000, 100000,
  ];
  for (let i = 0; i < 16; i += 1)
    queue.push(ql(dayIso(i + 30), 'signal', vals[i]!));
  const r = buildDailyTokenWilcoxonSignedRankHalves(queue, {
    minTokens: 1000,
    minTenureDays: 16,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'signal');
  assert.ok(r.sources[0]!.wsrPTwoSided < 0.05);
  assert.equal(r.sources[0]!.wsrSign, 1);
  assert.equal(r.sources[0]!.wsrWMinus, 0);
});

test('wsr: builder source-asc tie-break in sort=source', () => {
  const queue: QueueLine[] = [];
  const vals = [
    8000, 12000, 9000, 11000, 10000, 13000, 7000, 14000,
    98000, 102000, 95000, 105000, 99000, 101000, 100000, 100000,
  ];
  for (const src of ['z-src', 'a-src', 'm-src']) {
    for (let i = 0; i < 16; i += 1)
      queue.push(ql(dayIso(i), src, vals[i]!));
  }
  const r = buildDailyTokenWilcoxonSignedRankHalves(queue, {
    minTokens: 1000,
    minTenureDays: 16,
    sort: 'source',
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a-src', 'm-src', 'z-src'],
  );
});

test('wsr: builder honours top cap', () => {
  const queue: QueueLine[] = [];
  const vals = [
    8000, 12000, 9000, 11000, 10000, 13000, 7000, 14000,
    98000, 102000, 95000, 105000, 99000, 101000, 100000, 100000,
  ];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 16; i += 1)
      queue.push(ql(dayIso(i), src, vals[i]!));
  }
  const r = buildDailyTokenWilcoxonSignedRankHalves(queue, {
    minTokens: 1000,
    minTenureDays: 16,
    top: 2,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('wsr: builder rejects invalid sort', () => {
  assert.throws(
    () =>
      buildDailyTokenWilcoxonSignedRankHalves([], {
        sort: 'bogus' as any,
      }),
    /sort must be one of/,
  );
});

test('wsr: builder rejects invalid minTenureDays', () => {
  assert.throws(
    () => buildDailyTokenWilcoxonSignedRankHalves([], { minTenureDays: 8 }),
    /minTenureDays must be an integer >= 16/,
  );
});

test('wsr: builder counts droppedNonPositiveTokens and droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [];
  queue.push(ql('not-a-date', 'x', 100));
  queue.push(ql(dayIso(0), 'x', 0));
  queue.push(ql(dayIso(1), 'x', -5));
  const r = buildDailyTokenWilcoxonSignedRankHalves(queue, {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('wsr: builder source filter accepts and counts dropped', () => {
  const queue: QueueLine[] = [];
  const vals = [
    8000, 12000, 9000, 11000, 10000, 13000, 7000, 14000,
    98000, 102000, 95000, 105000, 99000, 101000, 100000, 100000,
  ];
  for (let i = 0; i < 16; i += 1) queue.push(ql(dayIso(i), 'keep', vals[i]!));
  for (let i = 0; i < 16; i += 1) queue.push(ql(dayIso(i), 'skip', vals[i]!));
  const r = buildDailyTokenWilcoxonSignedRankHalves(queue, {
    source: 'keep',
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.droppedSourceFilter, 16);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
});

test('wsr: builder rejects invalid since/until', () => {
  assert.throws(
    () => buildDailyTokenWilcoxonSignedRankHalves([], { since: 'bogus' }),
    /invalid since/,
  );
  assert.throws(
    () => buildDailyTokenWilcoxonSignedRankHalves([], { until: 'bogus' }),
    /invalid until/,
  );
});
