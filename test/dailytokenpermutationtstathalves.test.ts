import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenPermutationTstatHalves,
  buildDailyTokenPermutationTstatHalves,
  welchT,
  permutationTstatDecision,
} from '../src/dailytokenpermutationtstathalves.js';
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

// ---------- permutationTstatDecision ----------

test('perm: decision highly-significant at .0005', () => {
  assert.equal(permutationTstatDecision(0.0005), 'highly-significant');
  assert.equal(permutationTstatDecision(0.001), 'highly-significant');
});

test('perm: decision very-significant at .005', () => {
  assert.equal(permutationTstatDecision(0.005), 'very-significant');
  assert.equal(permutationTstatDecision(0.01), 'very-significant');
});

test('perm: decision significant at .03', () => {
  assert.equal(permutationTstatDecision(0.03), 'significant');
  assert.equal(permutationTstatDecision(0.05), 'significant');
});

test('perm: decision marginal at .08', () => {
  assert.equal(permutationTstatDecision(0.08), 'marginal');
  assert.equal(permutationTstatDecision(0.10), 'marginal');
});

test('perm: decision ns above .10', () => {
  assert.equal(permutationTstatDecision(0.11), 'ns');
  assert.equal(permutationTstatDecision(0.5), 'ns');
  assert.equal(permutationTstatDecision(1.0), 'ns');
});

test('perm: decision throws on out-of-range', () => {
  assert.throws(() => permutationTstatDecision(-0.01), /\[0, 1\]/);
  assert.throws(() => permutationTstatDecision(1.01), /\[0, 1\]/);
  assert.throws(() => permutationTstatDecision(NaN), /\[0, 1\]/);
});

// ---------- welchT ----------

test('perm: welchT zero shift gives t ~ 0', () => {
  const a = [1, 2, 3, 4, 5];
  const b = [1, 2, 3, 4, 5];
  const r = welchT(a, b);
  assert.equal(r.tStat, 0);
  assert.equal(r.meanA, 3);
  assert.equal(r.meanB, 3);
});

test('perm: welchT positive when B > A', () => {
  const a = [1, 2, 3, 4, 5];
  const b = [11, 12, 13, 14, 15];
  const r = welchT(a, b);
  assert.ok(r.tStat > 0);
  assert.equal(r.meanA, 3);
  assert.equal(r.meanB, 13);
});

test('perm: welchT negative when A > B', () => {
  const a = [11, 12, 13, 14, 15];
  const b = [1, 2, 3, 4, 5];
  const r = welchT(a, b);
  assert.ok(r.tStat < 0);
});

test('perm: welchT throws on n<2', () => {
  assert.throws(() => welchT([1], [2, 3]), /at least 2/);
  assert.throws(() => welchT([1, 2], [3]), /at least 2/);
});

test('perm: welchT throws on zero-pooled-SE', () => {
  assert.throws(() => welchT([5, 5, 5], [5, 5, 5]), /zero pooled/);
});

// ---------- dailyTokenPermutationTstatHalves ----------

test('perm: stat throws on n<16', () => {
  assert.throws(
    () => dailyTokenPermutationTstatHalves([1, 2, 3, 4, 5, 6, 7, 8], 1000),
    /at least 16/,
  );
});

test('perm: stat throws on non-finite values', () => {
  const v = Array.from({ length: 16 }, (_, i) => (i === 5 ? NaN : i + 1));
  assert.throws(
    () => dailyTokenPermutationTstatHalves(v, 1000),
    /finite values/,
  );
});

test('perm: stat throws on zero variance', () => {
  const v = new Array(16).fill(7);
  assert.throws(
    () => dailyTokenPermutationTstatHalves(v, 1000),
    /zero centred variance/,
  );
});

test('perm: stat throws on permutations<100', () => {
  const v = Array.from({ length: 16 }, (_, i) => i + 1);
  assert.throws(
    () => dailyTokenPermutationTstatHalves(v, 50),
    /permutations must be an integer >= 100/,
  );
});

test('perm: large clean shift produces small p-value and positive t', () => {
  // First half: ~10, second half: ~100. Strong second-half-larger signal.
  const v = [
    8, 12, 9, 11, 10, 13, 7, 14, // first half low
    98, 102, 95, 105, 99, 101, 100, 100, // second half high
  ];
  const r = dailyTokenPermutationTstatHalves(v, 5000);
  assert.equal(r.permN1, 8);
  assert.equal(r.permN2, 8);
  assert.ok(r.permTStat > 0, `expected positive t, got ${r.permTStat}`);
  assert.ok(r.permPTwoSided < 0.01, `expected p<0.01, got ${r.permPTwoSided}`);
  assert.ok(r.permPUpper < 0.01);
  assert.ok(r.permPLower > 0.99);
  assert.equal(r.permB, 5000);
  // Add-one floor.
  assert.ok(r.permPTwoSided >= 1 / 5001);
});

test('perm: large clean negative shift produces small p-value and negative t', () => {
  const v = [
    98, 102, 95, 105, 99, 101, 100, 100,
    8, 12, 9, 11, 10, 13, 7, 14,
  ];
  const r = dailyTokenPermutationTstatHalves(v, 5000);
  assert.ok(r.permTStat < 0);
  assert.ok(r.permPTwoSided < 0.01);
  assert.ok(r.permPLower < 0.01);
  assert.ok(r.permPUpper > 0.99);
});

test('perm: noise data gives p-value far from 0', () => {
  // Identical-distribution halves: pTwoSided should not be tiny.
  const v = [
    10, 12, 11, 13, 9, 14, 8, 15, 11, 12, 10, 13, 9, 14, 11, 12,
  ];
  const r = dailyTokenPermutationTstatHalves(v, 5000);
  assert.ok(r.permPTwoSided > 0.10, `expected p>0.10, got ${r.permPTwoSided}`);
});

test('perm: deterministic given identical input', () => {
  const v = [
    8, 12, 9, 11, 10, 13, 7, 14,
    98, 102, 95, 105, 99, 101, 100, 100,
  ];
  const r1 = dailyTokenPermutationTstatHalves(v, 2000);
  const r2 = dailyTokenPermutationTstatHalves(v, 2000);
  assert.equal(r1.permPTwoSided, r2.permPTwoSided);
  assert.equal(r1.permPUpper, r2.permPUpper);
  assert.equal(r1.permPLower, r2.permPLower);
  assert.equal(r1.permTStat, r2.permTStat);
});

test('perm: p-values respect add-one floor and ceiling', () => {
  const v = [
    8, 12, 9, 11, 10, 13, 7, 14,
    98, 102, 95, 105, 99, 101, 100, 100,
  ];
  const r = dailyTokenPermutationTstatHalves(v, 1000);
  const floor = 1 / 1001;
  assert.ok(r.permPTwoSided >= floor);
  assert.ok(r.permPUpper >= floor);
  assert.ok(r.permPLower >= floor);
  assert.ok(r.permPUpper <= 1);
  assert.ok(r.permPLower <= 1);
  assert.ok(r.permPTwoSided <= 1);
});

// ---------- builder ----------

test('perm: builder drops sparse / short / zero-variance sources', () => {
  const queue: QueueLine[] = [];
  // sparse: under 1000 tokens.
  queue.push(ql(dayIso(0), 'sparse', 100));
  // short: 5 days only.
  for (let i = 0; i < 5; i += 1) queue.push(ql(dayIso(i + 1), 'short', 5000));
  // zero-variance: 16 days, all 1000.
  for (let i = 0; i < 16; i += 1)
    queue.push(ql(dayIso(i + 10), 'flat', 1000));
  // signal: 16 days with strong shift.
  const vals = [
    8000, 12000, 9000, 11000, 10000, 13000, 7000, 14000,
    98000, 102000, 95000, 105000, 99000, 101000, 100000, 100000,
  ];
  for (let i = 0; i < 16; i += 1)
    queue.push(ql(dayIso(i + 30), 'signal', vals[i]!));

  const r = buildDailyTokenPermutationTstatHalves(queue, {
    minTokens: 1000,
    minTenureDays: 16,
    permutations: 1000,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'signal');
  assert.ok(r.sources[0]!.permPTwoSided < 0.05);
  assert.equal(r.sources[0]!.permSign, 1);
});

test('perm: builder source-asc tie-break in sort', () => {
  const queue: QueueLine[] = [];
  const vals = [
    8000, 12000, 9000, 11000, 10000, 13000, 7000, 14000,
    98000, 102000, 95000, 105000, 99000, 101000, 100000, 100000,
  ];
  for (const src of ['z-src', 'a-src', 'm-src']) {
    for (let i = 0; i < 16; i += 1)
      queue.push(ql(dayIso(i), src, vals[i]!));
  }
  const r = buildDailyTokenPermutationTstatHalves(queue, {
    minTokens: 1000,
    minTenureDays: 16,
    permutations: 500,
    sort: 'source',
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a-src', 'm-src', 'z-src'],
  );
});

test('perm: builder honours top cap and surfaces dropped count', () => {
  const queue: QueueLine[] = [];
  const vals = [
    8000, 12000, 9000, 11000, 10000, 13000, 7000, 14000,
    98000, 102000, 95000, 105000, 99000, 101000, 100000, 100000,
  ];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 16; i += 1)
      queue.push(ql(dayIso(i), src, vals[i]!));
  }
  const r = buildDailyTokenPermutationTstatHalves(queue, {
    minTokens: 1000,
    minTenureDays: 16,
    permutations: 500,
    top: 2,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('perm: builder rejects invalid sort', () => {
  assert.throws(
    () =>
      buildDailyTokenPermutationTstatHalves([], {
        sort: 'bogus' as any,
      }),
    /sort must be one of/,
  );
});

test('perm: builder rejects invalid permutations', () => {
  assert.throws(
    () => buildDailyTokenPermutationTstatHalves([], { permutations: 50 }),
    /permutations must be an integer >= 100/,
  );
});

test('perm: builder rejects invalid minTenureDays', () => {
  assert.throws(
    () => buildDailyTokenPermutationTstatHalves([], { minTenureDays: 8 }),
    /minTenureDays must be an integer >= 16/,
  );
});

test('perm: builder counts droppedNonPositiveTokens and droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [];
  queue.push(ql('not-a-date', 'x', 100));
  queue.push(ql(dayIso(0), 'x', 0));
  queue.push(ql(dayIso(1), 'x', -5));
  const r = buildDailyTokenPermutationTstatHalves(queue, {
    permutations: 500,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
});
