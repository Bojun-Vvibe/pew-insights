import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenRosenbaumAdjacencyHalves,
  buildDailyTokenRosenbaumAdjacencyHalves,
} from '../src/dailytokenrosenbaumadjacencyhalves.js';
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

// ---------- core: Rosenbaum's adjacency test ----------

test('dailyTokenRosenbaumAdjacencyHalves: rejects too few samples', () => {
  assert.throws(
    () => dailyTokenRosenbaumAdjacencyHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenRosenbaumAdjacencyHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenRosenbaumAdjacencyHalves([1, 2, 3, 4, 5, 6, 7, NaN]),
    /finite values/,
  );
});

test('dailyTokenRosenbaumAdjacencyHalves: rejects zero variance', () => {
  assert.throws(
    () => dailyTokenRosenbaumAdjacencyHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

test('dailyTokenRosenbaumAdjacencyHalves: perfect upper separation', () => {
  // A all small, B all large -> rsTUpper = n2, rsTLower = 0
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r = dailyTokenRosenbaumAdjacencyHalves(v);
  assert.equal(r.rsN1, 4);
  assert.equal(r.rsN2, 4);
  assert.equal(r.rsMaxA, 4);
  assert.equal(r.rsMinB, 100);
  assert.equal(r.rsTUpper, 4);
  assert.equal(r.rsTLower, 4);
  assert.equal(r.rsT, 8);
  assert.ok(r.rsZ > 1.5);
  assert.ok(r.rsTwoSidedP < 0.2);
  assert.equal(r.rsSignedDirection, 0); // upper == lower (both maximal)
});

test('dailyTokenRosenbaumAdjacencyHalves: upper-only separation', () => {
  // A's range covers a wide span; B sits entirely above max(A)
  // A = {1, 50, 75, 99}, B = {100, 101, 102, 103}
  // rsTUpper = 4 (all B > 99), rsTLower = 0 (no A < 100? 1<100, 50<100, 75<100, 99<100 -> 4)
  // Actually all A < min(B)=100, so rsTLower = 4 too. Let me reframe:
  // To get upper-only, need A's min to be <= B's min so rsTLower = 0
  // A = {1, 50, 99, 99.5}, B = {100, 101, 102, 103}
  // min(B) = 100; A values < 100: all 4 -> rsTLower = 4. Hmm.
  // To get rsTLower = 0 we need A's MIN >= B's MIN
  // A = {100, 50, 99, 99.5}; min(A) = 50. min(B)=100. A vals < 100: 50, 99, 99.5 = 3.
  // For rsTLower = 0 we need NO A value < min(B). So min(A) >= min(B).
  // A = {200, 150, 199, 199.5}, B = {100, 101, 102, 103}: max(A)=200, min(B)=100
  // rsTUpper: B vals > 200? None. rsTUpper = 0.
  // rsTLower: A vals < 100? None. rsTLower = 0.
  // rsT = 0; supports overlap (A is entirely above B).
  const v = [200, 150, 199, 199.5, 100, 101, 102, 103];
  const r = dailyTokenRosenbaumAdjacencyHalves(v);
  assert.equal(r.rsTUpper, 0);
  assert.equal(r.rsTLower, 0);
  assert.equal(r.rsT, 0);
});

test('dailyTokenRosenbaumAdjacencyHalves: signed direction +1 for upper-tail stretch', () => {
  // A within [1, 10]; B values mostly inside but two strongly above max(A)
  // A = {1, 5, 8, 10}, B = {2, 7, 100, 200}
  // max(A) = 10; rsTUpper = #{ b > 10 } = 2 (100, 200)
  // min(B) = 2; rsTLower = #{ a < 2 } = 1 (1)
  // signed = +1
  const v = [1, 5, 8, 10, 2, 7, 100, 200];
  const r = dailyTokenRosenbaumAdjacencyHalves(v);
  assert.equal(r.rsTUpper, 2);
  assert.equal(r.rsTLower, 1);
  assert.equal(r.rsSignedDirection, 1);
});

test('dailyTokenRosenbaumAdjacencyHalves: signed direction -1 for lower-tail stretch', () => {
  // Mirror: A spans a low envelope; B has values below A's min
  // A = {50, 60, 70, 80}; B = {55, 65, 1, 2}
  // max(A) = 80; rsTUpper = #{ b > 80 } = 0
  // min(B) = 1; rsTLower = #{ a < 1 } = 0. Hmm.
  // To make rsTLower nonzero, A must have low values
  // A = {1, 60, 70, 80}; B = {55, 65, 100, 102}
  // max(A)=80; rsTUpper = 2 (100, 102)
  // min(B)=55; rsTLower = #{ a < 55 } = 1 (the value 1)
  // direction +1. Need lower > upper:
  // A = {1, 2, 70, 80}; B = {55, 65, 100, 102}
  // max(A)=80; rsTUpper = 2 (100, 102)
  // min(B)=55; rsTLower = #{ a < 55 } = 2 (1, 2). tie.
  // A = {1, 2, 3, 80}; B = {55, 65, 100, 102}
  // max(A)=80; rsTUpper = 2; min(B)=55; rsTLower = 3. signed=-1.
  const v = [1, 2, 3, 80, 55, 65, 100, 102];
  const r = dailyTokenRosenbaumAdjacencyHalves(v);
  assert.equal(r.rsTUpper, 2);
  assert.equal(r.rsTLower, 3);
  assert.equal(r.rsSignedDirection, -1);
});

test('dailyTokenRosenbaumAdjacencyHalves: shift invariance', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r1 = dailyTokenRosenbaumAdjacencyHalves(v);
  const r2 = dailyTokenRosenbaumAdjacencyHalves(v.map((x) => x + 1234));
  assert.equal(r1.rsT, r2.rsT);
  assert.equal(r1.rsZ, r2.rsZ);
});

test('dailyTokenRosenbaumAdjacencyHalves: positive scale invariance', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r1 = dailyTokenRosenbaumAdjacencyHalves(v);
  const r2 = dailyTokenRosenbaumAdjacencyHalves(v.map((x) => 7.5 * x));
  assert.equal(r1.rsT, r2.rsT);
  assert.equal(r1.rsZ, r2.rsZ);
});

test('dailyTokenRosenbaumAdjacencyHalves: monotone-increasing transform invariance', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r1 = dailyTokenRosenbaumAdjacencyHalves(v);
  const r2 = dailyTokenRosenbaumAdjacencyHalves(v.map((x) => Math.log(x)));
  assert.equal(r1.rsT, r2.rsT);
  assert.equal(r1.rsZ, r2.rsZ);
});

test('dailyTokenRosenbaumAdjacencyHalves: E[T] and Var[T] formulas', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r = dailyTokenRosenbaumAdjacencyHalves(v);
  // n1 = n2 = 4, n = 8
  // E[T] = 8/5 + 8/5 = 16/5 = 3.2
  // Var[T] = 2*8*3*3 / (6*6) = 144 / 36 = 4
  assert.ok(Math.abs(r.rsExpT - 3.2) < 1e-9);
  assert.ok(Math.abs(r.rsVarT - 4) < 1e-9);
});

test('dailyTokenRosenbaumAdjacencyHalves: ties between max(A) and B are excluded (strict)', () => {
  // max(A) = 10; B has a 10 -> b > 10 is FALSE -> rsTUpper does not count it
  const v = [1, 5, 8, 10, 10, 20, 30, 40];
  const r = dailyTokenRosenbaumAdjacencyHalves(v);
  assert.equal(r.rsMaxA, 10);
  // B = {10, 20, 30, 40}; b > 10: 20, 30, 40 -> rsTUpper = 3
  assert.equal(r.rsTUpper, 3);
});

test('dailyTokenRosenbaumAdjacencyHalves: bounds 0 <= rsT <= n', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const r = dailyTokenRosenbaumAdjacencyHalves(v);
  assert.ok(r.rsT >= 0);
  assert.ok(r.rsT <= v.length);
});

test('dailyTokenRosenbaumAdjacencyHalves: odd n splits floor/ceil', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400, 500];
  const r = dailyTokenRosenbaumAdjacencyHalves(v);
  assert.equal(r.rsN1, 4);
  assert.equal(r.rsN2, 5);
  assert.equal(r.rsTUpper, 5);
  assert.equal(r.rsTLower, 4);
});

// ---------- builder: source pipeline ----------

test('buildDailyTokenRosenbaumAdjacencyHalves: defaults', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 4; i += 1) lines.push(ql(dayIso(i), 'low-high', 1000 + i));
  for (let i = 4; i < 8; i += 1)
    lines.push(ql(dayIso(i), 'low-high', 100000 + i));
  const r = buildDailyTokenRosenbaumAdjacencyHalves(lines, {
    minTenureDays: 8,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'low-high');
  assert.equal(row.rsT, 8);
});

test('buildDailyTokenRosenbaumAdjacencyHalves: rejects bad minTenureDays', () => {
  assert.throws(
    () => buildDailyTokenRosenbaumAdjacencyHalves([], { minTenureDays: 4 }),
    />= 8/,
  );
});

test('buildDailyTokenRosenbaumAdjacencyHalves: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenRosenbaumAdjacencyHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenRosenbaumAdjacencyHalves: drops zero-variance source', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) lines.push(ql(dayIso(i), 'flat', 1000));
  const r = buildDailyTokenRosenbaumAdjacencyHalves(lines, {
    minTenureDays: 8,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenRosenbaumAdjacencyHalves: drops below min tenure', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) lines.push(ql(dayIso(i), 'short', 1000 + i));
  const r = buildDailyTokenRosenbaumAdjacencyHalves(lines, {
    minTenureDays: 8,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenRosenbaumAdjacencyHalves: source filter', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) lines.push(ql(dayIso(i), 'a', 1000 + i));
  for (let i = 0; i < 8; i += 1)
    lines.push(ql(dayIso(i), 'b', 1000 + i * 7));
  const r = buildDailyTokenRosenbaumAdjacencyHalves(lines, {
    source: 'a',
    minTenureDays: 8,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 8);
});

test('buildDailyTokenRosenbaumAdjacencyHalves: top cap', () => {
  const lines: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    for (let i = 0; i < 8; i += 1)
      lines.push(ql(dayIso(i), s, 1000 + i * 100));
  }
  const r = buildDailyTokenRosenbaumAdjacencyHalves(lines, {
    minTenureDays: 8,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenRosenbaumAdjacencyHalves: sort by rsZAbsDesc', () => {
  const lines: QueueLine[] = [];
  // big-shift: separated halves -> rsT large, |Z| large
  for (let i = 0; i < 4; i += 1)
    lines.push(ql(dayIso(i), 'big-shift', 1000 + i));
  for (let i = 4; i < 8; i += 1)
    lines.push(ql(dayIso(i), 'big-shift', 100000 + i));
  // overlap: A = {200,150,199,199.5}, B = {100,101,102,103} -> rsT = 0
  const overlapVals = [200000, 150000, 199000, 199500, 100000, 101000, 102000, 103000];
  for (let i = 0; i < 8; i += 1)
    lines.push(ql(dayIso(i), 'overlap', overlapVals[i]!));
  const r = buildDailyTokenRosenbaumAdjacencyHalves(lines, {
    minTenureDays: 8,
    sort: 'rsZAbsDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'big-shift');
  assert.equal(r.sources[1]!.source, 'overlap');
});
