import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenLongestZeroRun,
  longestZeroRunOfMask,
} from '../src/dailytokenlongestzerorun.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-04T12:00:00.000Z';

test('primitive: empty mask -> longest=0, count=0', () => {
  const r = longestZeroRunOfMask([]);
  assert.equal(r.longestZeroRun, 0);
  assert.equal(r.zeroRunCount, 0);
  assert.equal(r.totalZeros, 0);
  assert.equal(r.longestStart, -1);
  assert.equal(r.longestEnd, -1);
});

test('primitive: all ones -> longest=0', () => {
  const r = longestZeroRunOfMask([1, 1, 1, 1, 1]);
  assert.equal(r.longestZeroRun, 0);
  assert.equal(r.zeroRunCount, 0);
});

test('primitive: all zeros -> longest=n, count=1', () => {
  const r = longestZeroRunOfMask([0, 0, 0, 0]);
  assert.equal(r.longestZeroRun, 4);
  assert.equal(r.zeroRunCount, 1);
  assert.equal(r.totalZeros, 4);
  assert.equal(r.longestStart, 0);
  assert.equal(r.longestEnd, 3);
});

test('primitive: closed-form [1,0,0,1,0,0,0,1] -> longest=3, runs=2, total=5', () => {
  const r = longestZeroRunOfMask([1, 0, 0, 1, 0, 0, 0, 1]);
  assert.equal(r.longestZeroRun, 3);
  assert.equal(r.zeroRunCount, 2);
  assert.equal(r.totalZeros, 5);
  assert.equal(r.longestStart, 4);
  assert.equal(r.longestEnd, 6);
});

test('primitive: tie-break first occurrence wins', () => {
  // two runs of length 2; earliest indices should be reported.
  const r = longestZeroRunOfMask([1, 0, 0, 1, 0, 0, 1]);
  assert.equal(r.longestZeroRun, 2);
  assert.equal(r.zeroRunCount, 2);
  assert.equal(r.longestStart, 1);
  assert.equal(r.longestEnd, 2);
});

test('builder: single source no calendar gaps -> longestZeroRun=0', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 5000),
    ql('2026-04-02T00:00:00Z', 's', 5000),
    ql('2026-04-03T00:00:00Z', 's', 5000),
  ];
  const r = buildDailyTokenLongestZeroRun(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.longestZeroRun, 0);
  assert.equal(row.spanDays, 3);
  assert.equal(row.nDays, 3);
  assert.equal(row.totalZeroDays, 0);
  assert.equal(row.zeroRunCount, 0);
  assert.equal(row.longestZeroRunStartDay, '');
  assert.equal(row.longestZeroRunEndDay, '');
});

test('builder: source with one 28-day gap -> longestZeroRun=28', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 's', 5000),
    ql('2026-01-30T00:00:00Z', 's', 5000),
  ];
  const r = buildDailyTokenLongestZeroRun(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.spanDays, 30);
  assert.equal(row.nDays, 2);
  assert.equal(row.longestZeroRun, 28);
  assert.equal(row.totalZeroDays, 28);
  assert.equal(row.zeroRunCount, 1);
  assert.equal(row.longestZeroRunStartDay, '2026-01-02');
  assert.equal(row.longestZeroRunEndDay, '2026-01-29');
  assert.ok(Math.abs(row.longestZeroRunShare - 28 / 30) < 1e-12);
});

test('builder: source with two gaps -> picks longest, counts both', () => {
  // active days: Jan 1, 4, 5, 12 -> mask [1,0,0,1,1,0,0,0,0,0,0,1]
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 's', 5000),
    ql('2026-01-04T00:00:00Z', 's', 5000),
    ql('2026-01-05T00:00:00Z', 's', 5000),
    ql('2026-01-12T00:00:00Z', 's', 5000),
  ];
  const r = buildDailyTokenLongestZeroRun(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.spanDays, 12);
  assert.equal(row.nDays, 4);
  assert.equal(row.longestZeroRun, 6);
  assert.equal(row.zeroRunCount, 2);
  assert.equal(row.totalZeroDays, 8);
  assert.equal(row.longestZeroRunStartDay, '2026-01-06');
  assert.equal(row.longestZeroRunEndDay, '2026-01-11');
});

test('builder: orthogonality witness vs permutation-invariant axes', () => {
  // Source U: 5 active days no gap. Source W: 2 active days,
  // 28-day gap. Both have nDays >= 2. Permutation-invariant
  // functionals on the active-day vector (Gini, HHI, Pielou)
  // see only [5000, 5000, ...] -- they have NO concept of
  // calendar gaps. longest-zero-run distinguishes them.
  const queue: QueueLine[] = [
    ql('2026-02-01T00:00:00Z', 'u', 5000),
    ql('2026-02-02T00:00:00Z', 'u', 5000),
    ql('2026-02-03T00:00:00Z', 'u', 5000),
    ql('2026-03-01T00:00:00Z', 'w', 5000),
    ql('2026-03-30T00:00:00Z', 'w', 5000),
  ];
  const r = buildDailyTokenLongestZeroRun(queue, { generatedAt: GEN });
  const u = r.sources.find((s) => s.source === 'u')!;
  const w = r.sources.find((s) => s.source === 'w')!;
  assert.equal(u.longestZeroRun, 0);
  assert.equal(w.longestZeroRun, 28);
});

test('builder: hour-of-day collapses to single UTC day', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 1000),
    ql('2026-04-01T15:00:00Z', 's', 2000),
    ql('2026-04-03T08:00:00Z', 's', 3000),
  ];
  const r = buildDailyTokenLongestZeroRun(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.nDays, 2);
  assert.equal(row.spanDays, 3);
  assert.equal(row.longestZeroRun, 1);
  assert.equal(row.longestZeroRunStartDay, '2026-04-02');
});

test('builder: rejects non-positive total_tokens, counts dropped', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 5000),
    ql('2026-04-02T00:00:00Z', 's', 0),
    ql('2026-04-02T00:00:00Z', 's', -1),
    ql('2026-04-03T00:00:00Z', 's', 5000),
  ];
  const r = buildDailyTokenLongestZeroRun(queue, { generatedAt: GEN });
  assert.equal(r.droppedNonPositiveTokens, 2);
  // The two zero/-1 rows didn't count as activity, so day 2 is
  // a calendar gap.
  const row = r.sources[0]!;
  assert.equal(row.nDays, 2);
  assert.equal(row.spanDays, 3);
  assert.equal(row.longestZeroRun, 1);
});

test('builder: invalid hour_start counted as droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 5000),
    ql('not-a-date', 's', 1000),
    ql('2026-04-03T00:00:00Z', 's', 5000),
  ];
  const r = buildDailyTokenLongestZeroRun(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('builder: --top after sort drops remainder', () => {
  const queue: QueueLine[] = [
    // a: gap of 5 days
    ql('2026-01-01T00:00:00Z', 'a', 5000),
    ql('2026-01-07T00:00:00Z', 'a', 5000),
    // b: gap of 1 day
    ql('2026-01-01T00:00:00Z', 'b', 5000),
    ql('2026-01-03T00:00:00Z', 'b', 5000),
    // c: gap of 10 days
    ql('2026-01-01T00:00:00Z', 'c', 5000),
    ql('2026-01-12T00:00:00Z', 'c', 5000),
  ];
  const r = buildDailyTokenLongestZeroRun(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[0]!.longestZeroRun, 10);
  assert.equal(r.sources[1]!.source, 'a');
  assert.equal(r.sources[1]!.longestZeroRun, 5);
});

test('builder: minLongestZeroRun filters', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 5000),
    ql('2026-01-03T00:00:00Z', 'a', 5000),
    ql('2026-01-01T00:00:00Z', 'b', 5000),
    ql('2026-01-12T00:00:00Z', 'b', 5000),
  ];
  const r = buildDailyTokenLongestZeroRun(queue, {
    generatedAt: GEN,
    minLongestZeroRun: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinLongestZeroRun, 1);
});

test('builder: option validation', () => {
  assert.throws(() =>
    buildDailyTokenLongestZeroRun([], { minTokens: -1, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenLongestZeroRun([], { minDays: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenLongestZeroRun([], { top: -3, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenLongestZeroRun([], {
      sort: 'bogus' as never,
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildDailyTokenLongestZeroRun([], {
      minLongestZeroRun: -1,
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildDailyTokenLongestZeroRun([], { since: 'bad', generatedAt: GEN }),
  );
});

test('builder: minTokens drops sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'low', 100),
    ql('2026-01-05T00:00:00Z', 'low', 100),
    ql('2026-01-01T00:00:00Z', 'hi', 5000),
    ql('2026-01-05T00:00:00Z', 'hi', 5000),
  ];
  const r = buildDailyTokenLongestZeroRun(queue, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'hi');
  assert.equal(r.droppedSparseSources, 1);
});

test('builder: sort by longestZeroRunShare', () => {
  const queue: QueueLine[] = [
    // a: span 3, longest 1 -> share 1/3
    ql('2026-01-01T00:00:00Z', 'a', 5000),
    ql('2026-01-03T00:00:00Z', 'a', 5000),
    // b: span 100, longest 50 -> share 0.5
    ql('2026-01-01T00:00:00Z', 'b', 5000),
    ql('2026-01-51T00:00:00Z'.replace('2026-01-51', '2026-02-20'), 'b', 5000),
    ql('2026-04-10T00:00:00Z', 'b', 5000),
  ];
  const r = buildDailyTokenLongestZeroRun(queue, {
    generatedAt: GEN,
    sort: 'longestZeroRunShare',
  });
  // b's share should be larger
  assert.equal(r.sources[0]!.source, 'b');
});

test('builder: source filter restricts and counts dropped rows', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'a', 5000),
    ql('2026-01-03T00:00:00Z', 'a', 5000),
    ql('2026-01-01T00:00:00Z', 'b', 5000),
    ql('2026-01-10T00:00:00Z', 'b', 5000),
  ];
  const r = buildDailyTokenLongestZeroRun(queue, {
    generatedAt: GEN,
    source: 'b',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[0]!.longestZeroRun, 8);
  assert.ok(r.droppedSourceFilter > 0);
});
