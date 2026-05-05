import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spearmanFootruleMidRanks,
  spearmanFootruleStatistic,
  spearmanFootruleExpectedD,
  spearmanFootruleVarianceD,
  standardNormalUpperTailSpearmanFootruleTime,
  dailyTokenSpearmanFootruleTime,
  buildDailyTokenSpearmanFootruleTime,
  aggregateSpearmanFootruleTime,
} from '../src/dailytokenspearmanfootruletime.js';
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

// ---------- spearmanFootruleMidRanks ----------

test('spearmanFootruleMidRanks: distinct ascending', () => {
  assert.deepEqual(spearmanFootruleMidRanks([10, 20, 30]), [1, 2, 3]);
});

test('spearmanFootruleMidRanks: distinct descending', () => {
  assert.deepEqual(spearmanFootruleMidRanks([30, 20, 10]), [3, 2, 1]);
});

test('spearmanFootruleMidRanks: simple ties get average rank', () => {
  // [3,1,1,2] sorted = 1,1,2,3 with ranks 1,2,3,4 -> ties at rank 1.5,1.5
  assert.deepEqual(spearmanFootruleMidRanks([3, 1, 1, 2]), [4, 1.5, 1.5, 3]);
});

test('spearmanFootruleMidRanks: all equal -> all average rank', () => {
  assert.deepEqual(spearmanFootruleMidRanks([5, 5, 5, 5]), [2.5, 2.5, 2.5, 2.5]);
});

test('spearmanFootruleMidRanks: triple tie at top', () => {
  // [1,2,7,7,7] -> ranks 1,2,4,4,4
  assert.deepEqual(spearmanFootruleMidRanks([1, 2, 7, 7, 7]), [1, 2, 4, 4, 4]);
});

test('spearmanFootruleMidRanks: ranks sum to n*(n+1)/2', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const ranks = spearmanFootruleMidRanks(xs);
  const total = ranks.reduce((a, b) => a + b, 0);
  assert.equal(total, (xs.length * (xs.length + 1)) / 2);
});

// ---------- spearmanFootruleStatistic ----------

test('spearmanFootruleStatistic: identity (perfect up-trend) -> D=0', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  assert.equal(spearmanFootruleStatistic(xs), 0);
});

test('spearmanFootruleStatistic: reverse (perfect down-trend) -> D=floor(n^2/2)', () => {
  const xs = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  // n=12 -> D_max = 12^2/2 = 72
  assert.equal(spearmanFootruleStatistic(xs), 72);
});

test('spearmanFootruleStatistic: single adjacent swap -> D=2', () => {
  const xs = [2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  assert.equal(spearmanFootruleStatistic(xs), 2);
});

test('spearmanFootruleStatistic: known small example', () => {
  // ranks of [10, 30, 20] = [1, 3, 2], indices = [1, 2, 3]
  // |1-1|+|3-2|+|2-3| = 0+1+1 = 2
  assert.equal(spearmanFootruleStatistic([10, 30, 20]), 2);
});

test('spearmanFootruleStatistic: shift-invariant', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const a = spearmanFootruleStatistic(xs);
  const b = spearmanFootruleStatistic(xs.map((v) => v + 1000));
  assert.equal(a, b);
});

test('spearmanFootruleStatistic: scale-invariant for positive scales', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const a = spearmanFootruleStatistic(xs);
  const b = spearmanFootruleStatistic(xs.map((v) => v * 7));
  assert.equal(a, b);
});

// ---------- expected/variance ----------

test('spearmanFootruleExpectedD: n=12 closed form', () => {
  // (144 - 1)/3 = 143/3
  assert.equal(spearmanFootruleExpectedD(12), 143 / 3);
});

test('spearmanFootruleExpectedD: n=2', () => {
  // (4 - 1)/3 = 1
  assert.equal(spearmanFootruleExpectedD(2), 1);
});

test('spearmanFootruleExpectedD: rejects non-integer', () => {
  assert.throws(() => spearmanFootruleExpectedD(1.5));
});

test('spearmanFootruleExpectedD: rejects n<2', () => {
  assert.throws(() => spearmanFootruleExpectedD(1));
});

test('spearmanFootruleVarianceD: n=12 closed form', () => {
  // (13)(2*144 + 7)/45 = 13 * 295 / 45 = 3835/45
  assert.equal(spearmanFootruleVarianceD(12), (13 * 295) / 45);
});

test('spearmanFootruleVarianceD: n=2', () => {
  // (3)(8+7)/45 = 45/45 = 1
  assert.equal(spearmanFootruleVarianceD(2), 1);
});

test('spearmanFootruleVarianceD: monotonically increasing in n', () => {
  for (let n = 12; n < 30; n += 1) {
    assert.ok(spearmanFootruleVarianceD(n) < spearmanFootruleVarianceD(n + 1));
  }
});

// ---------- standardNormalUpperTailSpearmanFootruleTime ----------

test('standardNormalUpperTail: Q(0) = 0.5', () => {
  assert.ok(
    Math.abs(standardNormalUpperTailSpearmanFootruleTime(0) - 0.5) < 1e-3,
  );
});

test('standardNormalUpperTail: Q(1.96) ~ 0.025', () => {
  assert.ok(
    Math.abs(standardNormalUpperTailSpearmanFootruleTime(1.96) - 0.025) < 1e-3,
  );
});

test('standardNormalUpperTail: symmetry Q(-z) = 1 - Q(z)', () => {
  const z = 1.5;
  const a = standardNormalUpperTailSpearmanFootruleTime(z);
  const b = standardNormalUpperTailSpearmanFootruleTime(-z);
  assert.ok(Math.abs(a + b - 1) < 1e-7);
});

test('standardNormalUpperTail: rejects non-finite', () => {
  assert.throws(() => standardNormalUpperTailSpearmanFootruleTime(Number.NaN));
});

// ---------- dailyTokenSpearmanFootruleTime ----------

test('dailyTokenSpearmanFootruleTime: perfect uptrend -> sfZ very negative', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r = dailyTokenSpearmanFootruleTime(xs);
  assert.equal(r.sfD, 0);
  assert.ok(r.sfZ < -2.5, `sfZ=${r.sfZ}`);
  assert.ok(r.sfPValue < 0.05, `sfPValue=${r.sfPValue}`);
});

test('dailyTokenSpearmanFootruleTime: perfect downtrend -> sfZ very positive', () => {
  const xs = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const r = dailyTokenSpearmanFootruleTime(xs);
  assert.equal(r.sfD, 72);
  assert.ok(r.sfZ > 2.5, `sfZ=${r.sfZ}`);
  assert.ok(r.sfPValue < 0.05, `sfPValue=${r.sfPValue}`);
});

test('dailyTokenSpearmanFootruleTime: balanced zigzag -> sfZ moderate', () => {
  const xs = [5, 1, 6, 2, 7, 3, 8, 4, 9, 5, 10, 6];
  const r = dailyTokenSpearmanFootruleTime(xs);
  // zigzag still has rising trend overall, expect sfZ < 0 (uptrend)
  assert.ok(r.sfZ < 0, `sfZ=${r.sfZ}`);
});

test('dailyTokenSpearmanFootruleTime: rejects n < 12', () => {
  assert.throws(() =>
    dailyTokenSpearmanFootruleTime([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  );
});

test('dailyTokenSpearmanFootruleTime: rejects non-finite', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, Number.NaN];
  assert.throws(() => dailyTokenSpearmanFootruleTime(xs));
});

test('dailyTokenSpearmanFootruleTime: rejects zero variance', () => {
  const xs = new Array<number>(12).fill(5);
  assert.throws(() => dailyTokenSpearmanFootruleTime(xs));
});

test('dailyTokenSpearmanFootruleTime: deterministic', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const a = dailyTokenSpearmanFootruleTime(xs);
  const b = dailyTokenSpearmanFootruleTime(xs.slice());
  assert.equal(a.sfD, b.sfD);
  assert.equal(a.sfZ, b.sfZ);
  assert.equal(a.sfPValue, b.sfPValue);
});

test('dailyTokenSpearmanFootruleTime: shift-invariance of Z', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const a = dailyTokenSpearmanFootruleTime(xs);
  const b = dailyTokenSpearmanFootruleTime(xs.map((v) => v + 100));
  assert.equal(a.sfZ, b.sfZ);
});

test('dailyTokenSpearmanFootruleTime: positive scale-invariance of Z', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const a = dailyTokenSpearmanFootruleTime(xs);
  const b = dailyTokenSpearmanFootruleTime(xs.map((v) => v * 13));
  assert.equal(a.sfZ, b.sfZ);
});

test('dailyTokenSpearmanFootruleTime: D in valid range [0, n^2/2]', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const r = dailyTokenSpearmanFootruleTime(xs);
  assert.ok(r.sfD >= 0);
  assert.ok(r.sfD <= (xs.length * xs.length) / 2);
});

test('dailyTokenSpearmanFootruleTime: expected matches closed form', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const r = dailyTokenSpearmanFootruleTime(xs);
  assert.equal(r.sfDExpected, (12 * 12 - 1) / 3);
});

// ---------- buildDailyTokenSpearmanFootruleTime ----------

test('build: empty queue -> empty report', () => {
  const r = buildDailyTokenSpearmanFootruleTime([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: single source uptrend gives negative sfZ', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1000 + i * 500));
  }
  const r = buildDailyTokenSpearmanFootruleTime(queue, {
    minTokens: 0,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.sfZ < 0, `sfZ=${r.sources[0]!.sfZ}`);
});

test('build: rejects minTenureDays < 12', () => {
  assert.throws(() =>
    buildDailyTokenSpearmanFootruleTime([], { minTenureDays: 11 }),
  );
});

test('build: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenSpearmanFootruleTime([], {
      sort: 'bogus' as never,
    }),
  );
});

test('build: rejects negative top', () => {
  assert.throws(() =>
    buildDailyTokenSpearmanFootruleTime([], { top: -1 }),
  );
});

test('build: source filter retains only matching source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1000 + i * 500));
    queue.push(ql(dayIso(i), 'srcB', 2000 - i * 100));
  }
  const r = buildDailyTokenSpearmanFootruleTime(queue, {
    minTokens: 0,
    source: 'srcA',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'srcA');
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: top cap drops trailing rows', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1000 + i * 500));
    queue.push(ql(dayIso(i), 'srcB', 2000 - i * 100));
  }
  const r = buildDailyTokenSpearmanFootruleTime(queue, {
    minTokens: 0,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 1);
});

test('build: invalid hour_start dropped and counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'srcA', 1000),
  ];
  for (let i = 0; i < 14; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1000 + i * 500));
  }
  const r = buildDailyTokenSpearmanFootruleTime(queue, {
    minTokens: 0,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

// ---------- aggregateSpearmanFootruleTime ----------

test('aggregate: empty rows -> safe defaults', () => {
  const a = aggregateSpearmanFootruleTime([]);
  assert.equal(a.rowsUsed, 0);
  assert.equal(a.stoufferZ, 0);
  assert.equal(a.stoufferTwoSidedPValue, 1);
});

test('aggregate: skips malformed rows', () => {
  const a = aggregateSpearmanFootruleTime([
    { sfZ: Number.NaN, sfPValue: 0.5, nTenureDays: 12 },
    { sfZ: 1, sfPValue: 0.5, nTenureDays: 11 }, // below floor
    { sfZ: 1, sfPValue: -0.1, nTenureDays: 12 }, // bad p
  ]);
  assert.equal(a.rowsUsed, 0);
  assert.equal(a.rowsSkipped, 3);
});

test('aggregate: stouffer combines signed Z correctly', () => {
  const a = aggregateSpearmanFootruleTime([
    { sfZ: 1, sfPValue: 0.3, nTenureDays: 12 },
    { sfZ: -1, sfPValue: 0.3, nTenureDays: 12 },
  ]);
  assert.equal(a.rowsUsed, 2);
  // (1 + -1) / sqrt(2) = 0
  assert.ok(Math.abs(a.stoufferZ) < 1e-12);
  assert.ok(Math.abs(a.meanSfZ) < 1e-12);
});

test('aggregate: tenure-weighted mean reflects long-tenure dominance', () => {
  const a = aggregateSpearmanFootruleTime([
    { sfZ: 2, sfPValue: 0.05, nTenureDays: 100 },
    { sfZ: -1, sfPValue: 0.3, nTenureDays: 12 },
  ]);
  assert.equal(a.rowsUsed, 2);
  // weighted = (100*2 + 12*-1)/112 = 188/112 ~ 1.679
  assert.ok(Math.abs(a.tenureWeightedMeanSfZ - 188 / 112) < 1e-9);
});

test('aggregate: stouffer pValue increases as |Z| decreases', () => {
  const a = aggregateSpearmanFootruleTime([
    { sfZ: 0.1, sfPValue: 0.92, nTenureDays: 12 },
  ]);
  assert.ok(a.stoufferTwoSidedPValue > 0.5);
});
