import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenWaldWolfowitzRunsHalves,
  buildDailyTokenWaldWolfowitzRunsHalves,
} from '../src/dailytokenwaldwolfowitzrunshalves.js';
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

// ---------- core: Wald-Wolfowitz runs test ----------

test('dailyTokenWaldWolfowitzRunsHalves: rejects too few samples', () => {
  assert.throws(
    () => dailyTokenWaldWolfowitzRunsHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenWaldWolfowitzRunsHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenWaldWolfowitzRunsHalves([1, 2, 3, 4, 5, 6, 7, NaN]),
    /finite values/,
  );
});

test('dailyTokenWaldWolfowitzRunsHalves: rejects zero variance', () => {
  assert.throws(
    () => dailyTokenWaldWolfowitzRunsHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

test('dailyTokenWaldWolfowitzRunsHalves: perfect separation gives R = 2', () => {
  // First half all small, second half all large. Pooled
  // sort: AAAABBBB -> R = 2.
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r = dailyTokenWaldWolfowitzRunsHalves(v);
  assert.equal(r.wwN1, 4);
  assert.equal(r.wwN2, 4);
  assert.equal(r.wwR, 2);
  // E[R] = 2*4*4/8 + 1 = 5. Z very negative.
  assert.ok(r.wwZ < -1.5);
  assert.ok(r.wwTwoSidedP < 0.2);
  assert.equal(r.wwSignedDirection, +1); // medB > medA
});

test('dailyTokenWaldWolfowitzRunsHalves: perfect separation reverse direction', () => {
  const v = [100, 200, 300, 400, 1, 2, 3, 4];
  const r = dailyTokenWaldWolfowitzRunsHalves(v);
  assert.equal(r.wwR, 2);
  assert.equal(r.wwSignedDirection, -1); // medB < medA
});

test('dailyTokenWaldWolfowitzRunsHalves: perfect alternation gives R = n', () => {
  // Pool sort: A,B,A,B,A,B,A,B -> R = 8.
  // A = {1,3,5,7}, B = {2,4,6,8}: pooled sort 1,2,3,4,5,6,7,8 -> ABABABAB.
  const v = [1, 3, 5, 7, 2, 4, 6, 8];
  const r = dailyTokenWaldWolfowitzRunsHalves(v);
  assert.equal(r.wwR, 8);
  // E[R] = 5. Z positive.
  assert.ok(r.wwZ > 1.5);
});

test('dailyTokenWaldWolfowitzRunsHalves: R near E[R] gives p ~ 1', () => {
  // Construct so R is close to 5.
  // A = {1, 4, 5, 8}, B = {2, 3, 6, 7}
  // pool sort 1,2,3,4,5,6,7,8 -> A B B A A B B A -> runs:
  // A | BB | AA | BB | A = 5 runs.
  const v = [1, 4, 5, 8, 2, 3, 6, 7];
  const r = dailyTokenWaldWolfowitzRunsHalves(v);
  assert.equal(r.wwR, 5);
  assert.equal(r.wwExpR, 5);
  assert.equal(r.wwZ, 0);
  assert.equal(r.wwTwoSidedP, 1);
});

test('dailyTokenWaldWolfowitzRunsHalves: shift invariance R(x+c) === R(x)', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r1 = dailyTokenWaldWolfowitzRunsHalves(v);
  const r2 = dailyTokenWaldWolfowitzRunsHalves(v.map((x) => x + 1234));
  assert.equal(r1.wwR, r2.wwR);
  assert.equal(r1.wwZ, r2.wwZ);
});

test('dailyTokenWaldWolfowitzRunsHalves: positive scale invariance R(a*x) === R(x)', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r1 = dailyTokenWaldWolfowitzRunsHalves(v);
  const r2 = dailyTokenWaldWolfowitzRunsHalves(v.map((x) => 7.5 * x));
  assert.equal(r1.wwR, r2.wwR);
  assert.equal(r1.wwZ, r2.wwZ);
});

test('dailyTokenWaldWolfowitzRunsHalves: monotone-increasing transform invariance', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r1 = dailyTokenWaldWolfowitzRunsHalves(v);
  const r2 = dailyTokenWaldWolfowitzRunsHalves(v.map((x) => Math.log(x)));
  assert.equal(r1.wwR, r2.wwR);
  assert.equal(r1.wwZ, r2.wwZ);
});

test('dailyTokenWaldWolfowitzRunsHalves: E[R] and Var[R] formulas', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r = dailyTokenWaldWolfowitzRunsHalves(v);
  // n1 = n2 = 4, n = 8
  // E[R] = 2*4*4/8 + 1 = 5
  // Var[R] = 2*4*4*(2*4*4 - 8) / (8*8*7) = 32*24 / 448 = 768/448 = 1.7142857...
  assert.equal(r.wwExpR, 5);
  assert.ok(Math.abs(r.wwVarR - 768 / 448) < 1e-9);
});

test('dailyTokenWaldWolfowitzRunsHalves: odd n splits floor/ceil', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400, 500];
  const r = dailyTokenWaldWolfowitzRunsHalves(v);
  assert.equal(r.wwN1, 4);
  assert.equal(r.wwN2, 5);
  // Pool sort: AAAA BBBBB -> R = 2.
  assert.equal(r.wwR, 2);
});

test('dailyTokenWaldWolfowitzRunsHalves: ties between different labels are conservative', () => {
  // Both halves have value 10 at one position. Tie-block
  // collapses to a single A-label adjacency (lower bound
  // on R). All other values separated.
  // A = {1, 10, 5, 7}, B = {10, 20, 30, 40}
  // Pooled sort by value (stable, A before B on tie):
  //   1(A) 5(A) 7(A) 10(A) 10(B) 20(B) 30(B) 40(B)
  // Tied block at value=10 has labels {A, B} -> collapses
  // to A-label single adjacency.
  // Collapsed sequence: A A A A B B B B (the 10(A) and
  // 10(B) merge to a single A token at value=10).
  // R = 2.
  const v = [1, 10, 5, 7, 10, 20, 30, 40];
  const r = dailyTokenWaldWolfowitzRunsHalves(v);
  assert.equal(r.wwR, 2);
});

test('dailyTokenWaldWolfowitzRunsHalves: median direction +1 when B-half rises', () => {
  const v = [1, 2, 3, 4, 100, 200, 300, 400];
  const r = dailyTokenWaldWolfowitzRunsHalves(v);
  assert.equal(r.wwSignedDirection, 1);
});

test('dailyTokenWaldWolfowitzRunsHalves: median direction 0 when medians coincide', () => {
  // A median = 2.5, B median = 2.5
  const v = [1, 2, 3, 4, 1, 2, 3, 4];
  // mn==mx? No, distinct. But this throws because the
  // two halves are IDENTICAL distribution -- no zero
  // centred variance? variance is positive. Should compute.
  const r = dailyTokenWaldWolfowitzRunsHalves(v);
  assert.equal(r.wwSignedDirection, 0);
});

test('dailyTokenWaldWolfowitzRunsHalves: 2 <= R <= n bound', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const r = dailyTokenWaldWolfowitzRunsHalves(v);
  assert.ok(r.wwR >= 2);
  assert.ok(r.wwR <= v.length);
});

// ---------- builder: source pipeline ----------

test('buildDailyTokenWaldWolfowitzRunsHalves: defaults', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 4; i += 1) lines.push(ql(dayIso(i), 'low-high', 1000 + i));
  for (let i = 4; i < 8; i += 1)
    lines.push(ql(dayIso(i), 'low-high', 100000 + i));
  const r = buildDailyTokenWaldWolfowitzRunsHalves(lines, {
    minTenureDays: 8,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'low-high');
  assert.equal(row.wwR, 2);
  assert.equal(row.wwSignedDirection, 1);
});

test('buildDailyTokenWaldWolfowitzRunsHalves: rejects bad minTenureDays', () => {
  assert.throws(
    () => buildDailyTokenWaldWolfowitzRunsHalves([], { minTenureDays: 4 }),
    />= 8/,
  );
});

test('buildDailyTokenWaldWolfowitzRunsHalves: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenWaldWolfowitzRunsHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenWaldWolfowitzRunsHalves: drops zero-variance source', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) lines.push(ql(dayIso(i), 'flat', 1000));
  const r = buildDailyTokenWaldWolfowitzRunsHalves(lines, {
    minTenureDays: 8,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenWaldWolfowitzRunsHalves: drops below min tenure', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) lines.push(ql(dayIso(i), 'short', 1000 + i));
  const r = buildDailyTokenWaldWolfowitzRunsHalves(lines, {
    minTenureDays: 8,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenWaldWolfowitzRunsHalves: source filter', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) lines.push(ql(dayIso(i), 'a', 1000 + i));
  for (let i = 0; i < 8; i += 1)
    lines.push(ql(dayIso(i), 'b', 1000 + i * 7));
  const r = buildDailyTokenWaldWolfowitzRunsHalves(lines, {
    source: 'a',
    minTenureDays: 8,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 8);
});

test('buildDailyTokenWaldWolfowitzRunsHalves: top cap', () => {
  const lines: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    for (let i = 0; i < 8; i += 1)
      lines.push(ql(dayIso(i), s, 1000 + i * 100));
  }
  const r = buildDailyTokenWaldWolfowitzRunsHalves(lines, {
    minTenureDays: 8,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenWaldWolfowitzRunsHalves: sort by wwZAbsDesc', () => {
  const lines: QueueLine[] = [];
  // Source 'big-shift': separated halves -> R = 2, |Z| large.
  for (let i = 0; i < 4; i += 1)
    lines.push(ql(dayIso(i), 'big-shift', 1000 + i));
  for (let i = 4; i < 8; i += 1)
    lines.push(ql(dayIso(i), 'big-shift', 100000 + i));
  // Source 'mid-shift': partial overlap, Z small.
  // A = {1,4,5,8}, B = {2,3,6,7} -> R = 5, Z = 0.
  const interleaved = [1, 4, 5, 8, 2, 3, 6, 7];
  for (let i = 0; i < 8; i += 1)
    lines.push(ql(dayIso(i), 'mid-shift', 1000 * interleaved[i]!));
  const r = buildDailyTokenWaldWolfowitzRunsHalves(lines, {
    minTenureDays: 8,
    sort: 'wwZAbsDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'big-shift');
  assert.equal(r.sources[1]!.source, 'mid-shift');
});
