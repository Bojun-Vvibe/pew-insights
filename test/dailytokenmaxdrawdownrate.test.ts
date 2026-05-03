import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenMaxDrawdownRate,
  maxDrawdownRateOfVector,
} from '../src/dailytokenmaxdrawdownrate.js';
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

test('primitive: empty -> degenerate, MDD=0', () => {
  const r = maxDrawdownRateOfVector([]);
  assert.equal(r.maxDrawdownRate, 0);
  assert.equal(r.degenerate, true);
  assert.equal(r.recovered, false);
});

test('primitive: n=1 -> degenerate, MDD=0', () => {
  const r = maxDrawdownRateOfVector([42]);
  assert.equal(r.maxDrawdownRate, 0);
  assert.equal(r.degenerate, true);
  assert.equal(r.peakValue, 42);
});

test('primitive: closed-form D=[4,3,2,1,5] -> MDD=0.75 at peak=0, trough=3', () => {
  const r = maxDrawdownRateOfVector([4, 3, 2, 1, 5]);
  assert.ok(Math.abs(r.maxDrawdownRate - 0.75) < 1e-15);
  assert.equal(r.peakIndex, 0);
  assert.equal(r.troughIndex, 3);
  assert.equal(r.peakValue, 4);
  assert.equal(r.troughValue, 1);
  assert.equal(r.recovered, true); // value 5 > peak 4 occurs at index 4
  assert.equal(r.degenerate, false);
});

test('primitive: monotone increasing -> MDD=0, recovered=false', () => {
  const r = maxDrawdownRateOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.maxDrawdownRate, 0);
  assert.equal(r.recovered, false);
});

test('primitive: monotone decreasing -> MDD=0.9, recovered=false', () => {
  const r = maxDrawdownRateOfVector([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
  assert.ok(Math.abs(r.maxDrawdownRate - 0.9) < 1e-12);
  assert.equal(r.peakIndex, 0);
  assert.equal(r.troughIndex, 9);
  assert.equal(r.recovered, false);
});

test('primitive: scale invariance MDD(c*v)=MDD(v)', () => {
  const base = [4, 3, 2, 1, 5];
  const r1 = maxDrawdownRateOfVector(base);
  const r2 = maxDrawdownRateOfVector(base.map((x) => x * 1e6));
  assert.ok(Math.abs(r1.maxDrawdownRate - r2.maxDrawdownRate) < 1e-15);
});

test('primitive: orthogonality witness -- same multiset, different MDDs', () => {
  // A: monotone decay, B: monotone growth, C: peak-on-day-2.
  // All share the SAME multiset {10,20,30,40,50,60,70,80,90,100}
  // hence identical Gini, HHI, Pielou, CR4, etc.
  const A = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
  const B = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const C = [10, 100, 20, 30, 40, 50, 60, 70, 80, 90];
  const rA = maxDrawdownRateOfVector(A).maxDrawdownRate;
  const rB = maxDrawdownRateOfVector(B).maxDrawdownRate;
  const rC = maxDrawdownRateOfVector(C).maxDrawdownRate;
  assert.ok(Math.abs(rA - 0.9) < 1e-12);
  assert.equal(rB, 0);
  assert.ok(Math.abs(rC - 0.8) < 1e-12);
});

test('primitive: rejects zero / negative / NaN', () => {
  assert.throws(() => maxDrawdownRateOfVector([1, 0, 2]), /strictly-positive/);
  assert.throws(() => maxDrawdownRateOfVector([1, -1, 2]), /strictly-positive/);
  assert.throws(() => maxDrawdownRateOfVector([1, NaN, 2]), /strictly-positive/);
});

test('builder: empty queue -> 0 sources, no rows', () => {
  const r = buildDailyTokenMaxDrawdownRate([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('builder: single source with daily decay -> mdd=0.9, regime catastrophic', () => {
  const queue: QueueLine[] = [];
  const vals = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
  for (let i = 0; i < vals.length; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`;
    // Multiply by 1000 so each row crosses min-tokens default cleanly.
    queue.push(ql(day, 'src', vals[i] * 1000));
  }
  const r = buildDailyTokenMaxDrawdownRate(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0];
  assert.ok(Math.abs(row.maxDrawdownRate - 0.9) < 1e-12);
  assert.equal(row.peakDay, '2026-04-01');
  assert.equal(row.troughDay, '2026-04-10');
  assert.equal(row.peakDailyTokens, 100000);
  assert.equal(row.troughDailyTokens, 10000);
  assert.equal(row.maxDrawdownDurationDays, 9);
  assert.equal(row.recovered, false);
  assert.equal(row.drawdownRegime, 'catastrophic');
  assert.equal(row.degenerate, false);
});

test('builder: regime banding -- flat / shallow / moderate / severe / catastrophic', () => {
  // Build five sources, each with two days, one for each band.
  // Day-1 token = peak. Day-2 token = trough.
  const cases: Array<[string, number, number, string]> = [
    ['flat-src', 5000, 5000, 'flat'],
    ['shallow-src', 5000, 4500, 'shallow'], // mdd 0.10
    ['moderate-src', 5000, 3000, 'moderate'], // mdd 0.40
    ['severe-src', 5000, 1000, 'severe'], // mdd 0.80
    ['catastrophic-src', 10000, 500, 'catastrophic'], // mdd 0.95
  ];
  const queue: QueueLine[] = [];
  for (const [src, a, b] of cases) {
    queue.push(ql('2026-04-01T00:00:00.000Z', src, a));
    queue.push(ql('2026-04-02T00:00:00.000Z', src, b));
  }
  const r = buildDailyTokenMaxDrawdownRate(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  // map by source name
  const bySrc = new Map(r.sources.map((s) => [s.source, s]));
  for (const [src, , , regime] of cases) {
    const row = bySrc.get(src);
    assert.ok(row, `missing row for ${src}`);
    assert.equal(row!.drawdownRegime, regime, `regime for ${src}`);
  }
});

test('builder: recovery flag set when post-trough day matches/exceeds peak', () => {
  // Series: [100, 50, 100] -> peak day1, trough day2, recovers day3.
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'src', 10000),
    ql('2026-04-02T00:00:00.000Z', 'src', 5000),
    ql('2026-04-03T00:00:00.000Z', 'src', 10000),
  ];
  const r = buildDailyTokenMaxDrawdownRate(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0];
  assert.ok(Math.abs(row.maxDrawdownRate - 0.5) < 1e-12);
  assert.equal(row.recovered, true);
  assert.equal(row.maxDrawdownDurationDays, 1);
  assert.equal(row.drawdownRegime, 'severe');
});

test('builder: hour-of-day rows on same UTC day collapse to a single day', () => {
  // Two hour-rows on day 1 sum to 8000, one row on day 2 = 2000.
  // Day series = [8000, 2000] -> mdd = 0.75
  const queue: QueueLine[] = [
    ql('2026-04-01T01:00:00.000Z', 'src', 5000),
    ql('2026-04-01T02:00:00.000Z', 'src', 3000),
    ql('2026-04-02T01:00:00.000Z', 'src', 2000),
  ];
  const r = buildDailyTokenMaxDrawdownRate(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0];
  assert.equal(row.nDays, 2);
  assert.ok(Math.abs(row.maxDrawdownRate - 0.75) < 1e-12);
  assert.equal(row.peakDay, '2026-04-01');
  assert.equal(row.peakDailyTokens, 8000);
  assert.equal(row.troughDay, '2026-04-02');
});

test('builder: --min-drawdown filter drops rows below threshold', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'low', 5000),
    ql('2026-04-02T00:00:00.000Z', 'low', 4500), // mdd 0.10
    ql('2026-04-01T00:00:00.000Z', 'high', 5000),
    ql('2026-04-02T00:00:00.000Z', 'high', 1000), // mdd 0.80
  ];
  const r = buildDailyTokenMaxDrawdownRate(queue, {
    generatedAt: GEN,
    minDrawdown: 0.5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'high');
  assert.equal(r.droppedBelowMinDrawdown, 1);
});

test('builder: validates options', () => {
  assert.throws(
    () => buildDailyTokenMaxDrawdownRate([], { minTokens: -1 }),
    /minTokens/,
  );
  assert.throws(
    () => buildDailyTokenMaxDrawdownRate([], { minDays: 1 }),
    /minDays/,
  );
  assert.throws(
    () => buildDailyTokenMaxDrawdownRate([], { top: -3 }),
    /top/,
  );
  assert.throws(
    () => buildDailyTokenMaxDrawdownRate([], { minDrawdown: 1 }),
    /minDrawdown/,
  );
  assert.throws(
    () =>
      buildDailyTokenMaxDrawdownRate([], {
        sort: 'nope' as unknown as 'maxDrawdownRate',
      }),
    /sort/,
  );
});

test('builder: bad hour_start counted in droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src', 5000),
    ql('2026-04-01T00:00:00.000Z', 'src', 5000),
    ql('2026-04-02T00:00:00.000Z', 'src', 1000),
  ];
  const r = buildDailyTokenMaxDrawdownRate(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('builder: top-N applied after sort', () => {
  const queue: QueueLine[] = [];
  // Three sources with mdds 0.9, 0.5, 0.1
  const setups: Array<[string, number, number]> = [
    ['big', 10000, 1000],
    ['mid', 10000, 5000],
    ['small', 10000, 9000],
  ];
  for (const [src, a, b] of setups) {
    queue.push(ql('2026-04-01T00:00:00.000Z', src, a));
    queue.push(ql('2026-04-02T00:00:00.000Z', src, b));
  }
  const r = buildDailyTokenMaxDrawdownRate(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0].source, 'big');
  assert.equal(r.sources[1].source, 'mid');
  assert.equal(r.droppedTopSources, 1);
});

test('builder: partialRecoveryRatio = 0 at trough, 1 at peak, intermediate scales linearly', () => {
  // Series: peak=10000, trough=2000 -> drop 8000.
  // prr = (last - 2000) / 8000.
  // Case A: last == trough (2000) -> prr = 0
  // Case B: last == peak (10000) -> prr = 1, recovered = true
  // Case C: last == 6000 -> prr = 0.5, recovered = false
  const cases: Array<[string, number, number, number, boolean]> = [
    ['at-trough', 2000, 0, 0, false],
    ['at-peak', 10000, 1, 1, true],
    ['half', 6000, 0.5, 0.5, false],
    ['overshoot', 14000, 1.5, 1.5, true],
  ];
  for (const [src, lastVal, expectedPrr, _e2, expectedRec] of cases) {
    const queue: QueueLine[] = [
      ql('2026-04-01T00:00:00.000Z', src, 10000),
      ql('2026-04-02T00:00:00.000Z', src, 2000),
      ql('2026-04-03T00:00:00.000Z', src, lastVal),
    ];
    const r = buildDailyTokenMaxDrawdownRate(queue, { generatedAt: GEN });
    assert.equal(r.sources.length, 1, `case ${src}`);
    const row = r.sources[0]!;
    assert.ok(
      Math.abs(row.partialRecoveryRatio - expectedPrr) < 1e-12,
      `case ${src}: expected prr ${expectedPrr}, got ${row.partialRecoveryRatio}`,
    );
    assert.equal(row.recovered, expectedRec, `case ${src} recovered`);
  }
});

test('builder: partialRecoveryRatio is 0 for monotone-up (no drawdown)', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'src', 5000),
    ql('2026-04-02T00:00:00.000Z', 'src', 7000),
    ql('2026-04-03T00:00:00.000Z', 'src', 9000),
  ];
  const r = buildDailyTokenMaxDrawdownRate(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.maxDrawdownRate, 0);
  assert.equal(row.partialRecoveryRatio, 0);
  assert.equal(row.drawdownRegime, 'flat');
});
