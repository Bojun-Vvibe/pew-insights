import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenUpperRecordsCount,
  buildDailyTokenUpperRecordsCount,
} from '../src/dailytokenupperrecordscount.js';
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

function harmonic(n: number): number {
  let s = 0;
  for (let k = 1; k <= n; k += 1) s += 1 / k;
  return s;
}
function harmonic2(n: number): number {
  let s = 0;
  for (let k = 1; k <= n; k += 1) s += 1 / (k * k);
  return s;
}

// ---------- primitive ----------

test('dailyTokenUpperRecordsCount: rejects fewer than 3 samples', () => {
  assert.throws(
    () => dailyTokenUpperRecordsCount([5, 6]),
    /at least 3 samples/,
  );
});

test('dailyTokenUpperRecordsCount: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenUpperRecordsCount([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenUpperRecordsCount([1, Infinity, 3]),
    /finite values/,
  );
});

test('dailyTokenUpperRecordsCount: strictly monotone increasing -> R = n', () => {
  const r = dailyTokenUpperRecordsCount([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.nUpperRecords, 8);
  assert.equal(r.nUpperRecordsLoose, 8);
  assert.equal(r.lastRecordIndex, 7);
  assert.equal(r.argmaxIndex, 7);
  assert.equal(r.maxValue, 8);
});

test('dailyTokenUpperRecordsCount: strictly monotone decreasing -> R = 1', () => {
  const r = dailyTokenUpperRecordsCount([8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(r.nUpperRecords, 1);
  assert.equal(r.nUpperRecordsLoose, 1);
  assert.equal(r.lastRecordIndex, 0);
  assert.equal(r.argmaxIndex, 0);
  assert.equal(r.maxValue, 8);
});

test('dailyTokenUpperRecordsCount: constant series -> strict R = 1, loose R = n', () => {
  const r = dailyTokenUpperRecordsCount([5, 5, 5, 5, 5, 5]);
  assert.equal(r.nUpperRecords, 1);
  assert.equal(r.nUpperRecordsLoose, 6);
  assert.equal(r.lastRecordIndex, 0);
  assert.equal(r.maxValue, 5);
});

test('dailyTokenUpperRecordsCount: strict (>) does not count ties', () => {
  // 1,2,2,3,3,3 -> records at index 0 (1), 1 (2 > 1), 3 (3 > 2). Total = 3.
  const r = dailyTokenUpperRecordsCount([1, 2, 2, 3, 3, 3]);
  assert.equal(r.nUpperRecords, 3);
  // loose: 0,1,2,3,4,5 -> 6
  assert.equal(r.nUpperRecordsLoose, 6);
  assert.equal(r.lastRecordIndex, 3);
});

test('dailyTokenUpperRecordsCount: spike pattern, last index sets new high', () => {
  // 1,2,3,4,3,2,1,99 -> records at 0,1,2,3,7. R = 5, lastIdx=7
  const r = dailyTokenUpperRecordsCount([1, 2, 3, 4, 3, 2, 1, 99]);
  assert.equal(r.nUpperRecords, 5);
  assert.equal(r.lastRecordIndex, 7);
  assert.equal(r.argmaxIndex, 7);
  assert.equal(r.maxValue, 99);
});

test('dailyTokenUpperRecordsCount: early peak followed by valleys -> R = 1', () => {
  const r = dailyTokenUpperRecordsCount([100, 50, 60, 70, 80, 90, 95, 99]);
  assert.equal(r.nUpperRecords, 1);
  assert.equal(r.lastRecordIndex, 0);
  assert.equal(r.argmaxIndex, 0);
});

test('dailyTokenUpperRecordsCount: closed-form expectation H_n', () => {
  const r = dailyTokenUpperRecordsCount([1, 2, 3, 4, 5, 6, 7, 8]);
  const Hn = harmonic(8);
  assert.ok(
    Math.abs(r.recordExpectedIid - Hn) < 1e-12,
    `expected H_8 = ${Hn}, got ${r.recordExpectedIid}`,
  );
});

test('dailyTokenUpperRecordsCount: closed-form variance H_n - H_n^(2)', () => {
  const r = dailyTokenUpperRecordsCount([1, 2, 3, 4, 5, 6, 7, 8]);
  const expected = harmonic(8) - harmonic2(8);
  assert.ok(
    Math.abs(r.recordVarIid - expected) < 1e-12,
    `expected H_8 - H_8^(2) = ${expected}, got ${r.recordVarIid}`,
  );
});

test('dailyTokenUpperRecordsCount: n=4 minimal case has stable variance', () => {
  // H_4 = 1 + 1/2 + 1/3 + 1/4 = 25/12 ~ 2.0833
  // H_4^(2) = 1 + 1/4 + 1/9 + 1/16 ~ 1.4236
  // Var ~ 0.6597
  const r = dailyTokenUpperRecordsCount([1, 2, 3, 4]);
  assert.equal(r.nUpperRecords, 4);
  assert.ok(Math.abs(r.recordExpectedIid - 25 / 12) < 1e-12);
  assert.ok(r.recordVarIid > 0.65 && r.recordVarIid < 0.66);
});

test('dailyTokenUpperRecordsCount: n < 4 yields recordZ = 0', () => {
  const r = dailyTokenUpperRecordsCount([1, 2, 3]);
  assert.equal(r.recordZ, 0);
});

test('dailyTokenUpperRecordsCount: monotone increasing has positive recordZ', () => {
  const r = dailyTokenUpperRecordsCount([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.recordZ > 0);
});

test('dailyTokenUpperRecordsCount: monotone decreasing has negative recordZ', () => {
  const r = dailyTokenUpperRecordsCount([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.ok(r.recordZ < 0);
});

test('dailyTokenUpperRecordsCount: mean and stddev are population formulas', () => {
  const r = dailyTokenUpperRecordsCount([2, 4, 6, 8]);
  assert.equal(r.mean, 5);
  // population stddev: sqrt( ((-3)^2 + (-1)^2 + 1^2 + 3^2) / 4 ) = sqrt(20/4) = sqrt(5)
  assert.ok(Math.abs(r.stddev - Math.sqrt(5)) < 1e-12);
});

test('dailyTokenUpperRecordsCount: argmax tiebreak picks first occurrence', () => {
  const r = dailyTokenUpperRecordsCount([1, 2, 5, 3, 5, 4]);
  assert.equal(r.maxValue, 5);
  assert.equal(r.argmaxIndex, 2); // first 5
  // strict records: 0 (1), 1 (2 > 1), 2 (5 > 2). Index 4 has 5 == prev max -> not strict.
  assert.equal(r.nUpperRecords, 3);
});

test('dailyTokenUpperRecordsCount: zero-padded sparse pattern', () => {
  // gap-filled: real value, zeros, late spike
  const r = dailyTokenUpperRecordsCount([
    100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 200,
  ]);
  // strict records: index 0 (100), index 14 (200). R = 2.
  assert.equal(r.nUpperRecords, 2);
  assert.equal(r.lastRecordIndex, 14);
  // loose: index 0 (100), then nothing >= 100 until 14. 100,then 0s never tie or exceed. then 200. loose = 2.
  assert.equal(r.nUpperRecordsLoose, 2);
});

test('dailyTokenUpperRecordsCount: invariance under translation by adding constant fails (records depend on absolute order, but ordering preserved => same R)', () => {
  const a = dailyTokenUpperRecordsCount([1, 5, 3, 9, 2, 11]);
  const b = dailyTokenUpperRecordsCount([101, 105, 103, 109, 102, 111]);
  assert.equal(a.nUpperRecords, b.nUpperRecords);
  assert.equal(a.lastRecordIndex, b.lastRecordIndex);
});

test('dailyTokenUpperRecordsCount: invariance under positive scaling', () => {
  const a = dailyTokenUpperRecordsCount([1, 5, 3, 9, 2, 11]);
  const b = dailyTokenUpperRecordsCount([10, 50, 30, 90, 20, 110]);
  assert.equal(a.nUpperRecords, b.nUpperRecords);
});

test('dailyTokenUpperRecordsCount: time reversal usually changes R (not symmetric)', () => {
  // monotone increasing has R = n; reversed is decreasing has R = 1.
  const fwd = dailyTokenUpperRecordsCount([1, 2, 3, 4, 5, 6, 7]);
  const rev = dailyTokenUpperRecordsCount([7, 6, 5, 4, 3, 2, 1]);
  assert.notEqual(fwd.nUpperRecords, rev.nUpperRecords);
});

// ---------- builder ----------

test('buildDailyTokenUpperRecordsCount: empty queue', () => {
  const r = buildDailyTokenUpperRecordsCount([], {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.totalTokens, 0);
});

test('buildDailyTokenUpperRecordsCount: drops sources below min-tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'shortie', 100));
  }
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 10,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenUpperRecordsCount: drops sources below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'lowVol', 1));
  }
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenUpperRecordsCount: drops zero-variance gap-filled series', () => {
  // Active days have same total_tokens AND no gaps -> filled is constant.
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 100));
  }
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 100,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenUpperRecordsCount: monotone increasing source -> R = nTenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'incsrc', 100 + i));
  }
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 100,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'incsrc');
  assert.equal(r.sources[0]!.nTenureDays, 20);
  assert.equal(r.sources[0]!.nUpperRecords, 20);
  assert.ok(r.sources[0]!.recordZ > 0);
});

test('buildDailyTokenUpperRecordsCount: monotone decreasing source -> R = 1', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'decsrc', 200 - i));
  }
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 100,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nUpperRecords, 1);
  assert.equal(r.sources[0]!.lastRecordIndex, 0);
  assert.ok(r.sources[0]!.recordZ < 0);
});

test('buildDailyTokenUpperRecordsCount: gap-filling pads zeros between active days', () => {
  // Day 0 = 100, Day 14 = 50. Tenure = 15. Gap-filled middle is zero.
  // strict records: [100, 0, 0, .., 0, 50] -> only index 0. R = 1.
  const queue: QueueLine[] = [
    ql(dayIso(0), 'gapsrc', 100),
    ql(dayIso(14), 'gapsrc', 50),
  ];
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 100,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 15);
  assert.equal(r.sources[0]!.nUpperRecords, 1);
  assert.equal(r.sources[0]!.argmaxIndex, 0);
});

test('buildDailyTokenUpperRecordsCount: late new high is captured', () => {
  // First 14 days = 50, day 14 = 1000.
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    queue.push(ql(dayIso(i), 'latespike', 50));
  }
  queue.push(ql(dayIso(14), 'latespike', 1000));
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 100,
  });
  assert.equal(r.sources.length, 1);
  // strict records: index 0 (50), index 14 (1000). R = 2.
  assert.equal(r.sources[0]!.nUpperRecords, 2);
  assert.equal(r.sources[0]!.lastRecordIndex, 14);
  assert.equal(r.sources[0]!.argmaxIndex, 14);
});

test('buildDailyTokenUpperRecordsCount: sort=recordZAbsDesc orders by |recordZ|', () => {
  const queue: QueueLine[] = [];
  // Source A: monotone increasing -> very positive Z
  for (let i = 0; i < 25; i += 1) queue.push(ql(dayIso(i), 'aaa', 100 + i));
  // Source B: small fluctuation -> ~ 0 Z
  for (let i = 0; i < 25; i += 1)
    queue.push(ql(dayIso(i), 'bbb', 100 + ((i * 7) % 5)));
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 100,
    sort: 'recordZAbsDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    Math.abs(r.sources[0]!.recordZ) >= Math.abs(r.sources[1]!.recordZ),
  );
  assert.equal(r.sources[0]!.source, 'aaa');
});

test('buildDailyTokenUpperRecordsCount: sort=records ascending', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) queue.push(ql(dayIso(i), 'asc', 100 + i));
  for (let i = 0; i < 25; i += 1) queue.push(ql(dayIso(i), 'desc', 200 - i));
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 100,
    sort: 'records',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.nUpperRecords <= r.sources[1]!.nUpperRecords);
  assert.equal(r.sources[0]!.source, 'desc');
});

test('buildDailyTokenUpperRecordsCount: sort=source alphabetical fallback', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'zeta', 100 + i));
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'alpha', 100 + i));
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 100,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('buildDailyTokenUpperRecordsCount: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    for (let i = 0; i < 20; i += 1)
      queue.push(ql(dayIso(i), s, 100 + i));
  }
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 100,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenUpperRecordsCount: source filter restricts and counts dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'kept', 100 + i));
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'other', 100 + i));
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 100,
    source: 'kept',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'kept');
  assert.equal(r.droppedSourceFilter, 20);
});

test('buildDailyTokenUpperRecordsCount: drops invalid hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-an-iso', 'badtime', 100),
    ql(dayIso(0), 'goodtime', 100),
  ];
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 1,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenUpperRecordsCount: drops non-positive token rows', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 's', 0),
    ql(dayIso(1), 's', -5),
    ql(dayIso(2), 's', 100),
  ];
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    minTenureDays: 14,
    minTokens: 1,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenUpperRecordsCount: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenUpperRecordsCount([], {
        generatedAt: '2026-05-03T00:00:00.000Z',
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenUpperRecordsCount: rejects bad min-tenure-days', () => {
  assert.throws(
    () =>
      buildDailyTokenUpperRecordsCount([], {
        generatedAt: '2026-05-03T00:00:00.000Z',
        minTenureDays: 2,
      }),
    /minTenureDays/,
  );
});

test('buildDailyTokenUpperRecordsCount: rejects bad min-tokens', () => {
  assert.throws(
    () =>
      buildDailyTokenUpperRecordsCount([], {
        generatedAt: '2026-05-03T00:00:00.000Z',
        minTokens: -1,
      }),
    /minTokens/,
  );
});

test('buildDailyTokenUpperRecordsCount: rejects bad top', () => {
  assert.throws(
    () =>
      buildDailyTokenUpperRecordsCount([], {
        generatedAt: '2026-05-03T00:00:00.000Z',
        top: -3,
      }),
    /top must be a non-negative integer/,
  );
});

test('buildDailyTokenUpperRecordsCount: report carries the sort key it used', () => {
  const r = buildDailyTokenUpperRecordsCount([], {
    generatedAt: '2026-05-03T00:00:00.000Z',
    sort: 'recordZDesc',
  });
  assert.equal(r.sort, 'recordZDesc');
});

test('buildDailyTokenUpperRecordsCount: window since/until trims rows', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) queue.push(ql(dayIso(i), 's', 100 + i));
  const r = buildDailyTokenUpperRecordsCount(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
    since: dayIso(5),
    until: dayIso(25),
    minTenureDays: 14,
    minTokens: 100,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 20);
});

test('buildDailyTokenUpperRecordsCount: orthogonality smoke vs Spearman/Kendall lag-1 -- different functional', () => {
  // A series with strong lag-1 anti-correlation but very few records
  // (2-cycle near a constant base) -- records detects the global
  // upward trend regardless of lag-1 alternation.
  const series = [
    100, 50, 102, 52, 104, 54, 106, 56, 108, 58, 110, 60, 112, 62, 200,
  ];
  const r = dailyTokenUpperRecordsCount(series);
  // Records: 100, 102, 104, 106, 108, 110, 112, 200 -> 8.
  assert.equal(r.nUpperRecords, 8);
  // Same series, time-reversed: would have totally different records.
  const rev = [...series].reverse();
  const r2 = dailyTokenUpperRecordsCount(rev);
  assert.notEqual(r.nUpperRecords, r2.nUpperRecords);
});

test('buildDailyTokenUpperRecordsCount: closed-form variance is positive for n>=2', () => {
  // A strictly-increasing series so variance is well-defined.
  const r = dailyTokenUpperRecordsCount([1, 2, 3, 4, 5]);
  assert.ok(r.recordVarIid > 0);
});

test('dailyTokenUpperRecordsCount: argmaxIndex points to FIRST max occurrence even with later equal values', () => {
  const r = dailyTokenUpperRecordsCount([1, 9, 2, 9, 3, 9]);
  assert.equal(r.argmaxIndex, 1);
  assert.equal(r.maxValue, 9);
  // strict records: 1, 9 (>1). Only index 0 and 1.
  assert.equal(r.nUpperRecords, 2);
  assert.equal(r.lastRecordIndex, 1);
});
