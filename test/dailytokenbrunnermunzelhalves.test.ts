import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenBrunnerMunzelHalves,
  buildDailyTokenBrunnerMunzelHalves,
  midRanksBM,
  studentTTwoSidedBM,
  regularisedIncompleteBetaBM,
  lanczosLogGammaBM,
} from '../src/dailytokenbrunnermunzelhalves.js';
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

// ---------- primitive: midRanksBM ----------

test('midRanksBM: no-tie strictly increasing yields 1..n', () => {
  assert.deepEqual(midRanksBM([10, 20, 30, 40]), [1, 2, 3, 4]);
});

test('midRanksBM: no-tie strictly decreasing yields n..1', () => {
  assert.deepEqual(midRanksBM([40, 30, 20, 10]), [4, 3, 2, 1]);
});

test('midRanksBM: ties get average rank', () => {
  // sorted positions: 5,5,5,7 -> ranks 1,2,3,4 -> mid (1+2+3)/3=2 for ties at 5
  assert.deepEqual(midRanksBM([5, 5, 7, 5]), [2, 2, 4, 2]);
});

test('midRanksBM: pair tie at top', () => {
  // 1,2,9,9 -> ranks 1,2, (3+4)/2=3.5, 3.5
  assert.deepEqual(midRanksBM([1, 2, 9, 9]), [1, 2, 3.5, 3.5]);
});

// ---------- primitive: lanczosLogGammaBM ----------

test('lanczosLogGammaBM: log Gamma(1) = 0', () => {
  assert.ok(Math.abs(lanczosLogGammaBM(1)) < 1e-12);
});

test('lanczosLogGammaBM: log Gamma(0.5) = log(sqrt(pi))', () => {
  const expected = 0.5 * Math.log(Math.PI);
  assert.ok(Math.abs(lanczosLogGammaBM(0.5) - expected) < 1e-10);
});

test('lanczosLogGammaBM: log Gamma(5) = log(24)', () => {
  assert.ok(Math.abs(lanczosLogGammaBM(5) - Math.log(24)) < 1e-10);
});

test('lanczosLogGammaBM: rejects non-positive', () => {
  assert.throws(() => lanczosLogGammaBM(0), /must be > 0/);
  assert.throws(() => lanczosLogGammaBM(-1), /must be > 0/);
});

// ---------- primitive: regularised incomplete beta ----------

test('regularisedIncompleteBetaBM: I_0(a,b) = 0', () => {
  assert.equal(regularisedIncompleteBetaBM(0, 2, 3), 0);
});

test('regularisedIncompleteBetaBM: I_1(a,b) = 1', () => {
  assert.equal(regularisedIncompleteBetaBM(1, 2, 3), 1);
});

test('regularisedIncompleteBetaBM: I_{1/2}(1,1) = 1/2 (uniform)', () => {
  assert.ok(
    Math.abs(regularisedIncompleteBetaBM(0.5, 1, 1) - 0.5) < 1e-10,
  );
});

test('regularisedIncompleteBetaBM: symmetry I_x(a,b) + I_{1-x}(b,a) = 1', () => {
  const x = 0.3;
  const a = 2.7;
  const b = 4.1;
  const left = regularisedIncompleteBetaBM(x, a, b);
  const right = regularisedIncompleteBetaBM(1 - x, b, a);
  assert.ok(Math.abs(left + right - 1) < 1e-10);
});

test('regularisedIncompleteBetaBM: rejects bad inputs', () => {
  assert.throws(() => regularisedIncompleteBetaBM(-0.1, 1, 1), /x in \[0,1\]/);
  assert.throws(() => regularisedIncompleteBetaBM(1.1, 1, 1), /x in \[0,1\]/);
  assert.throws(() => regularisedIncompleteBetaBM(0.5, 0, 1), /a > 0/);
  assert.throws(() => regularisedIncompleteBetaBM(0.5, 1, 0), /b > 0/);
});

// ---------- primitive: Student-t two-sided ----------

test('studentTTwoSidedBM: t=0 gives p=1', () => {
  assert.equal(studentTTwoSidedBM(0, 10), 1);
});

test('studentTTwoSidedBM: standard t critical t(10) ~ 2.228 -> p ~ 0.05', () => {
  const p = studentTTwoSidedBM(2.228, 10);
  assert.ok(Math.abs(p - 0.05) < 5e-4);
});

test('studentTTwoSidedBM: standard normal limit (large dof)', () => {
  // t(1e6) at z=1.96 should be ~ 0.05
  const p = studentTTwoSidedBM(1.96, 1e6);
  assert.ok(Math.abs(p - 0.05) < 1e-3);
});

test('studentTTwoSidedBM: monotone in |t|', () => {
  const p1 = studentTTwoSidedBM(1, 20);
  const p2 = studentTTwoSidedBM(2, 20);
  const p3 = studentTTwoSidedBM(3, 20);
  assert.ok(p1 > p2);
  assert.ok(p2 > p3);
});

test('studentTTwoSidedBM: rejects bad inputs', () => {
  assert.throws(() => studentTTwoSidedBM(-1, 10), /non-negative/);
  assert.throws(() => studentTTwoSidedBM(1, 0), /v must be positive/);
});

// ---------- core: dailyTokenBrunnerMunzelHalves ----------

test('dailyTokenBrunnerMunzelHalves: rejects n < 16', () => {
  assert.throws(
    () => dailyTokenBrunnerMunzelHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
    /at least 16 samples/,
  );
});

test('dailyTokenBrunnerMunzelHalves: rejects non-finite values', () => {
  const arr = new Array(16).fill(0).map((_, i) => i + 1);
  arr[5] = NaN;
  assert.throws(() => dailyTokenBrunnerMunzelHalves(arr), /finite/);
});

test('dailyTokenBrunnerMunzelHalves: rejects zero variance', () => {
  const arr = new Array(20).fill(7);
  assert.throws(() => dailyTokenBrunnerMunzelHalves(arr), /zero centred variance/);
});

test('dailyTokenBrunnerMunzelHalves: shift invariance bmW(x + c) = bmW(x)', () => {
  // truly overlapping halves so placement variances are non-degenerate
  const x = [1, 8, 3, 12, 5, 14, 7, 16, 9, 4, 11, 6, 13, 2, 15, 10, 17, 19];
  const r1 = dailyTokenBrunnerMunzelHalves(x);
  const r2 = dailyTokenBrunnerMunzelHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.bmW - r2.bmW) < 1e-12);
  assert.ok(Math.abs(r1.bmRelative - r2.bmRelative) < 1e-12);
  assert.ok(Math.abs(r1.bmDof - r2.bmDof) < 1e-12);
  assert.ok(Math.abs(r1.bmPValue - r2.bmPValue) < 1e-12);
});

test('dailyTokenBrunnerMunzelHalves: positive scale invariance bmW(a*x) = bmW(x)', () => {
  const x = [1, 8, 3, 12, 5, 14, 7, 16, 9, 4, 11, 6, 13, 2, 15, 10, 17, 19];
  const r1 = dailyTokenBrunnerMunzelHalves(x);
  const r2 = dailyTokenBrunnerMunzelHalves(x.map((v) => v * 7));
  assert.ok(Math.abs(r1.bmW - r2.bmW) < 1e-12);
  assert.ok(Math.abs(r1.bmRelative - r2.bmRelative) < 1e-12);
  assert.ok(Math.abs(r1.bmDof - r2.bmDof) < 1e-12);
});

test('dailyTokenBrunnerMunzelHalves: second-half-larger (overlapping) -> bmRelative > 0.5 and bmW > 0', () => {
  // overlapping but second half stochastically larger
  const x = [1, 5, 2, 6, 3, 7, 4, 8, 4, 8, 5, 9, 6, 10, 7, 11, 8, 12];
  const r = dailyTokenBrunnerMunzelHalves(x);
  assert.ok(r.bmRelative > 0.5);
  assert.ok(r.bmW > 0);
});

test('dailyTokenBrunnerMunzelHalves: first-half-larger (overlapping) -> bmRelative < 0.5 and bmW < 0', () => {
  const x = [4, 8, 5, 9, 6, 10, 7, 11, 8, 12, 1, 5, 2, 6, 3, 7, 4, 8];
  const r = dailyTokenBrunnerMunzelHalves(x);
  assert.ok(r.bmRelative < 0.5);
  assert.ok(r.bmW < 0);
});

test('dailyTokenBrunnerMunzelHalves: shape invariants', () => {
  const x = [1, 8, 3, 12, 5, 14, 7, 16, 9, 4, 11, 6, 13, 2, 15, 10, 17, 19];
  const r = dailyTokenBrunnerMunzelHalves(x);
  assert.equal(r.nSamples, 18);
  assert.equal(r.bmN1, 9);
  assert.equal(r.bmN2, 9);
  assert.ok(r.bmDof > 0);
  assert.ok(r.bmPValue >= 0 && r.bmPValue <= 1);
  assert.ok(r.bmSAsq >= 0);
  assert.ok(r.bmSBsq >= 0);
  assert.ok(r.bmRelative >= 0 && r.bmRelative <= 1);
});

test('dailyTokenBrunnerMunzelHalves: equal halves give bmRelative ~ 0.5 and bmW ~ 0', () => {
  // identical halves
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const x = [...half, ...half];
  const r = dailyTokenBrunnerMunzelHalves(x);
  // With identical halves, every X<Y count balances ties -> p_hat = 0.5
  assert.ok(Math.abs(r.bmRelative - 0.5) < 1e-12);
  assert.ok(Math.abs(r.bmW) < 1e-12);
  assert.ok(r.bmPValue > 0.99);
});

// ---------- builder ----------

test('buildDailyTokenBrunnerMunzelHalves: empty queue -> no rows', () => {
  const r = buildDailyTokenBrunnerMunzelHalves([], { generatedAt: 'X' });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.generatedAt, 'X');
});

test('buildDailyTokenBrunnerMunzelHalves: drops below min-tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 5000));
  }
  const r = buildDailyTokenBrunnerMunzelHalves(queue, { generatedAt: 'X' });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenBrunnerMunzelHalves: drops sparse sources by min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1));
  }
  const r = buildDailyTokenBrunnerMunzelHalves(queue, {
    generatedAt: 'X',
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenBrunnerMunzelHalves: drops zero-variance gap-filled', () => {
  // 20 days but values constant -> zero variance after gap fill
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1000));
  }
  const r = buildDailyTokenBrunnerMunzelHalves(queue, { generatedAt: 'X' });
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenBrunnerMunzelHalves: produces a row for varying source', () => {
  const queue: QueueLine[] = [];
  // overlapping pattern so placement variance is non-degenerate
  const pat = [1, 5, 2, 6, 3, 7, 4, 8, 9, 13, 10, 14, 11, 15, 12, 16, 17, 19, 18, 20];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1000 * pat[i]!));
  }
  const r = buildDailyTokenBrunnerMunzelHalves(queue, { generatedAt: 'X' });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'srcA');
  assert.equal(row.bmN1 + row.bmN2, row.nTenureDays);
  // second half mostly larger -> bmRelative > 0.5
  assert.ok(row.bmRelative > 0.5);
  assert.ok(row.bmW > 0);
});

test('buildDailyTokenBrunnerMunzelHalves: rejects min-tenure-days < 16', () => {
  assert.throws(
    () => buildDailyTokenBrunnerMunzelHalves([], { minTenureDays: 15 }),
    />= 16/,
  );
});

test('buildDailyTokenBrunnerMunzelHalves: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenBrunnerMunzelHalves([], {
        sort: 'bogus' as any,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenBrunnerMunzelHalves: sort by tokens desc', () => {
  const queue: QueueLine[] = [];
  const pat = [1, 5, 2, 6, 3, 7, 4, 8, 9, 13, 10, 14, 11, 15, 12, 16, 17, 19, 18, 20];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 10000 * pat[i]!));
    queue.push(ql(dayIso(i), 'srcB', 100 * pat[i]!));
  }
  const r = buildDailyTokenBrunnerMunzelHalves(queue, {
    generatedAt: 'X',
    sort: 'tokens',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'srcA');
  assert.equal(r.sources[1]!.source, 'srcB');
});

test('buildDailyTokenBrunnerMunzelHalves: top cap', () => {
  const queue: QueueLine[] = [];
  const pat = [1, 5, 2, 6, 3, 7, 4, 8, 9, 13, 10, 14, 11, 15, 12, 16, 17, 19, 18, 20];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 10000 * pat[i]!));
    queue.push(ql(dayIso(i), 'srcB', 100 * pat[i]!));
  }
  const r = buildDailyTokenBrunnerMunzelHalves(queue, {
    generatedAt: 'X',
    sort: 'tokens',
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources[0]!.source, 'srcA');
});

test('buildDailyTokenBrunnerMunzelHalves: source filter', () => {
  const queue: QueueLine[] = [];
  const pat = [1, 5, 2, 6, 3, 7, 4, 8, 9, 13, 10, 14, 11, 15, 12, 16, 17, 19, 18, 20];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1000 * pat[i]!));
    queue.push(ql(dayIso(i), 'srcB', 100 * pat[i]!));
  }
  const r = buildDailyTokenBrunnerMunzelHalves(queue, {
    generatedAt: 'X',
    source: 'srcA',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'srcA');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenBrunnerMunzelHalves: drops invalid hour_start', () => {
  const pat = [1, 5, 2, 6, 3, 7, 4, 8, 9, 13, 10, 14, 11, 15, 12, 16, 17, 19, 18, 20];
  const queue: QueueLine[] = [
    ql('not-an-iso-string', 'srcA', 1000),
    ...Array.from({ length: 20 }, (_, i) => ql(dayIso(i), 'srcA', 1000 * pat[i]!)),
  ];
  const r = buildDailyTokenBrunnerMunzelHalves(queue, { generatedAt: 'X' });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenBrunnerMunzelHalves: drops non-positive tokens', () => {
  const pat = [1, 5, 2, 6, 3, 7, 4, 8, 9, 13, 10, 14, 11, 15, 12, 16, 17, 19, 18, 20];
  const queue: QueueLine[] = [
    ql(dayIso(0), 'srcA', 0),
    ql(dayIso(1), 'srcA', -10),
    ...Array.from({ length: 20 }, (_, i) => ql(dayIso(i + 2), 'srcA', 1000 * pat[i]!)),
  ];
  const r = buildDailyTokenBrunnerMunzelHalves(queue, { generatedAt: 'X' });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenBrunnerMunzelHalves: since/until window filtering', () => {
  const pat = [1, 5, 2, 6, 3, 7, 4, 8, 9, 13, 10, 14, 11, 15, 12, 16, 17, 19, 18, 20];
  const queue: QueueLine[] = Array.from({ length: 30 }, (_, i) =>
    ql(dayIso(i), 'srcA', 1000 * (pat[i % pat.length]!)),
  );
  const r = buildDailyTokenBrunnerMunzelHalves(queue, {
    generatedAt: 'X',
    since: dayIso(5),
    until: dayIso(25),
  });
  // 20-day window
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 20);
});
