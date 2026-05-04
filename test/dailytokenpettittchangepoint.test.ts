import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenPettittChangepoint,
  pettittSummary,
} from '../src/dailytokenpettittchangepoint.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, tokens: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

const GEN = '2026-05-04T12:00:00.000Z';

// ---- option validation ---------------------------------------------------

test('pettitt: rejects bad minDays', () => {
  assert.throws(() => buildDailyTokenPettittChangepoint([], { minDays: 3 }));
  assert.throws(() => buildDailyTokenPettittChangepoint([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenPettittChangepoint([], { minDays: -1 }));
});

test('pettitt: rejects bad top', () => {
  assert.throws(() => buildDailyTokenPettittChangepoint([], { top: -1 }));
  assert.throws(() => buildDailyTokenPettittChangepoint([], { top: 1.5 }));
});

test('pettitt: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenPettittChangepoint([], { sort: 'nope' as 'tokens' }),
  );
});

test('pettitt: rejects bad since/until', () => {
  assert.throws(() => buildDailyTokenPettittChangepoint([], { since: 'no' }));
  assert.throws(() => buildDailyTokenPettittChangepoint([], { until: 'nope' }));
});

test('pettitt: empty queue -> empty sources', () => {
  const r = buildDailyTokenPettittChangepoint([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.minDays, 4);
  assert.equal(r.sort, 'tokens');
});

// ---- pettittSummary pure helper -----------------------------------------

test('pettittSummary: empty -> flat', () => {
  const s = pettittSummary([]);
  assert.equal(s.flat, true);
  assert.equal(s.kt, 0);
  assert.equal(s.tStarIndex, -1);
  assert.equal(s.pApprox, 1);
});

test('pettittSummary: single value -> flat', () => {
  const s = pettittSummary([42]);
  assert.equal(s.flat, true);
  assert.equal(s.kt, 0);
  assert.equal(s.tStarIndex, -1);
});

test('pettittSummary: constant series -> flat', () => {
  const s = pettittSummary([5, 5, 5, 5, 5]);
  assert.equal(s.flat, true);
  assert.equal(s.kt, 0);
  assert.equal(s.tStarIndex, -1);
  assert.equal(s.pApprox, 1);
  assert.equal(s.meanShift, 0);
});

test('pettittSummary: clean step shift up at index 4 (n=10)', () => {
  // Pre [1..5] = 1, post [5..9] = 100 -> tStar should be 4 (last index of "before").
  const v = [1, 1, 1, 1, 1, 100, 100, 100, 100, 100];
  const s = pettittSummary(v);
  assert.equal(s.flat, false);
  assert.equal(s.tStarIndex, 4);
  assert.ok(s.kt > 0);
  // KT for clean split with equal halves: KT = 2 * (sum of ranks before) - (t+1)*(n+1)
  // ranks 1..5 averaged to 3, ranks 6..10 averaged to 8; sum_before = 5*3 = 15
  // U[4] = 2*15 - 5*11 = 30 - 55 = -25 -> |U[4]| = 25
  assert.equal(s.kt, 25);
  assert.equal(s.meanBefore, 1);
  assert.equal(s.meanAfter, 100);
  assert.equal(s.meanShift, 99);
  assert.ok(s.pApprox >= 0 && s.pApprox <= 1);
  // ktNormalized = 25 / (100/4) = 25 / 25 = 1.0
  assert.ok(Math.abs(s.ktNormalized - 1.0) < 1e-9);
});

test('pettittSummary: clean step shift DOWN', () => {
  const v = [100, 100, 100, 100, 1, 1, 1, 1];
  const s = pettittSummary(v);
  assert.equal(s.flat, false);
  assert.equal(s.tStarIndex, 3);
  assert.equal(s.meanBefore, 100);
  assert.equal(s.meanAfter, 1);
  assert.ok(s.meanShift < 0);
});

test('pettittSummary: monotone increasing -> tStar near middle, ktNorm < 1', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const s = pettittSummary(v);
  assert.equal(s.flat, false);
  // For monotone: tStar at n/2 - 1 = 4 (or thereabouts).
  assert.ok(s.tStarIndex >= 3 && s.tStarIndex <= 5);
  // ktNormalized is in (0, 1] (a perfectly monotone sequence achieves 1.0).
  assert.ok(s.ktNormalized > 0 && s.ktNormalized <= 1.0001);
});

test('pettittSummary: V-shape has large kt at vertex', () => {
  // V-shape: high, low at middle, high
  const v = [10, 10, 10, 1, 1, 1, 10, 10, 10];
  const s = pettittSummary(v);
  assert.equal(s.flat, false);
  // First major shift is going down at index ~2 (last of high-pre).
  assert.ok(s.tStarIndex >= 0 && s.tStarIndex <= 7);
});

test('pettittSummary: handles duplicates via average ranks', () => {
  const v = [2, 2, 2, 5, 5, 5];
  const s = pettittSummary(v);
  assert.equal(s.flat, false);
  assert.equal(s.tStarIndex, 2);
  // ranks: 2->mean(1,2,3)=2; 5->mean(4,5,6)=5; sum_before = 6
  // U[2] = 2*6 - 3*7 = 12 - 21 = -9 -> kt = 9
  assert.equal(s.kt, 9);
});

test('pettittSummary: pApprox is small for strong shifts', () => {
  const v = [1, 1, 1, 1, 1, 1, 1, 1, 100, 100, 100, 100, 100, 100, 100, 100];
  const s = pettittSummary(v);
  assert.ok(s.pApprox < 0.05);
});

test('pettittSummary: pApprox approaches 1 for noise (small kt)', () => {
  // Alternating tiny series
  const v = [1, 2, 1, 2];
  const s = pettittSummary(v);
  assert.ok(s.pApprox > 0.5);
});

test('pettittSummary: rank-based -> outlier-robust (vs CUSUM-style)', () => {
  // No real changepoint; one giant outlier in the middle.
  const v = [1, 2, 1, 2, 1, 1e9, 2, 1, 2, 1];
  const s = pettittSummary(v);
  // Pettitt is rank-based: ranks are 1..10, the 1e9 just gets rank 10.
  // KT remains modest (no clean split).
  assert.ok(s.kt < 25, `expected modest kt for outlier-only series, got ${s.kt}`);
});

test('pettittSummary: reverse symmetry — reversing series mirrors tStar', () => {
  const v = [1, 1, 1, 1, 1, 1, 100, 100, 100, 100];
  const r = pettittSummary(v);
  const v2 = v.slice().reverse();
  const r2 = pettittSummary(v2);
  // Reversed: shift is at index 3 (last of "100,100,100,100" pre)
  assert.equal(r.tStarIndex, 5);
  assert.equal(r2.tStarIndex, 3);
  // KT magnitudes should be equal
  assert.equal(r.kt, r2.kt);
});

test('pettittSummary: ktNormalized in [0,1] for any input we test', () => {
  const cases: number[][] = [
    [1, 2, 3, 4],
    [5, 5, 6, 6, 7, 7],
    [1, 100, 1, 100, 1, 100],
    [1, 1, 1, 100, 100, 100, 100, 100],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  ];
  for (const v of cases) {
    const s = pettittSummary(v);
    assert.ok(s.ktNormalized >= 0 && s.ktNormalized <= 1.0001, `ktNorm out of range for ${v.join(',')}: ${s.ktNormalized}`);
  }
});

test('pettittSummary: meanBefore/meanAfter consistent with tStar', () => {
  const v = [1, 1, 1, 1, 50, 50, 50, 50];
  const s = pettittSummary(v);
  assert.equal(s.tStarIndex, 3);
  assert.equal(s.meanBefore, 1);
  assert.equal(s.meanAfter, 50);
});

test('pettittSummary: deterministic on identical inputs', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3];
  const a = pettittSummary(v);
  const b = pettittSummary(v.slice());
  assert.deepEqual(a, b);
});

test('pettittSummary: n=2 with shift', () => {
  const s = pettittSummary([1, 100]);
  assert.equal(s.flat, false);
  assert.equal(s.tStarIndex, 0);
  assert.equal(s.meanBefore, 1);
  assert.equal(s.meanAfter, 100);
});

test('pettittSummary: n=2 equal -> flat', () => {
  const s = pettittSummary([7, 7]);
  assert.equal(s.flat, true);
});

// ---- builder integration -------------------------------------------------

test('pettitt: aggregates per-source per-day', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'A', 100),
    ql('2026-04-01T01:00:00.000Z', 'A', 50),
    ql('2026-04-02T00:00:00.000Z', 'A', 200),
    ql('2026-04-03T00:00:00.000Z', 'A', 300),
    ql('2026-04-04T00:00:00.000Z', 'A', 5000),
    ql('2026-04-05T00:00:00.000Z', 'A', 6000),
  ];
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
  // Day 1 = 150, Day 2 = 200, Day 3 = 300, Day 4 = 5000, Day 5 = 6000
  assert.equal(r.sources[0]!.totalTokens, 11650);
  assert.equal(r.sources[0]!.nFilledDays, 5);
  assert.equal(r.sources[0]!.flat, false);
  assert.ok(r.sources[0]!.kt > 0);
});

test('pettitt: drops sources below minDays', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'A', 100),
    ql('2026-04-02T00:00:00.000Z', 'A', 200),
    ql('2026-04-03T00:00:00.000Z', 'A', 300),
  ];
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN, minDays: 4 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('pettitt: gap fills zeros in tenure', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'A', 100),
    // 2026-04-02 gap (zero)
    // 2026-04-03 gap (zero)
    ql('2026-04-04T00:00:00.000Z', 'A', 200),
  ];
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nActiveDays, 2);
  assert.equal(r.sources[0]!.nFilledDays, 4);
});

test('pettitt: source filter restricts and counts droppedSourceFilter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'A', 100),
    ql('2026-04-02T00:00:00.000Z', 'A', 200),
    ql('2026-04-03T00:00:00.000Z', 'A', 300),
    ql('2026-04-04T00:00:00.000Z', 'A', 400),
    ql('2026-04-01T00:00:00.000Z', 'B', 999),
  ];
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN, source: 'A' });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
  assert.equal(r.droppedSourceFilter, 1);
});

test('pettitt: drops zero/negative tokens and bad hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'A', 100),
    ql('2026-04-01T00:00:00.000Z', 'A', 0),
    ql('2026-04-01T00:00:00.000Z', 'A', -5),
    ql('2026-04-01T00:00:00.000Z', 'A', 100),
    ql('2026-04-02T00:00:00.000Z', 'A', 200),
    ql('2026-04-03T00:00:00.000Z', 'A', 300),
    ql('2026-04-04T00:00:00.000Z', 'A', 400),
  ];
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.sources.length, 1);
});

test('pettitt: since/until window filter', () => {
  const queue: QueueLine[] = [
    ql('2026-03-31T00:00:00.000Z', 'A', 9999),
    ql('2026-04-01T00:00:00.000Z', 'A', 100),
    ql('2026-04-02T00:00:00.000Z', 'A', 200),
    ql('2026-04-03T00:00:00.000Z', 'A', 300),
    ql('2026-04-04T00:00:00.000Z', 'A', 400),
    ql('2026-04-05T00:00:00.000Z', 'A', 9999),
  ];
  const r = buildDailyTokenPettittChangepoint(queue, {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalTokens, 1000);
});

test('pettitt: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['A', 'B', 'C']) {
    for (let d = 1; d <= 5; d++) {
      const day = `2026-04-0${d}T00:00:00.000Z`;
      queue.push(ql(day, src, src === 'A' ? 1000 : src === 'B' ? 500 : 100));
    }
  }
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('pettitt: sort by p (smallest first)', () => {
  const queue: QueueLine[] = [];
  // Source A: clean step shift (small p)
  for (let d = 1; d <= 8; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'A', d <= 4 ? 100 : 10000));
  }
  // Source B: noisy (large p)
  for (let d = 1; d <= 8; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'B', 100 + (d % 2)));
  }
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN, sort: 'p' });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'A');
  assert.ok(r.sources[0]!.pApprox < r.sources[1]!.pApprox);
});

test('pettitt: sort by kt desc', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 6; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'A', d <= 3 ? 1 : 100));
  }
  for (let d = 1; d <= 6; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'B', d <= 3 ? 1 : 2));
  }
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN, sort: 'kt' });
  assert.equal(r.sources[0]!.source, 'A');
  assert.ok(r.sources[0]!.kt >= r.sources[1]!.kt);
});

test('pettitt: sort by abszshift', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 6; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'A', d <= 3 ? 1 : 1000));
  }
  for (let d = 1; d <= 6; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'B', d <= 3 ? 100 : 105));
  }
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN, sort: 'abszshift' });
  assert.equal(r.sources[0]!.source, 'A');
});

test('pettitt: sort by ndays', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 4; d++) queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'A', 100));
  for (let d = 1; d <= 8; d++) queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'B', 100));
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN, sort: 'ndays' });
  assert.equal(r.sources[0]!.source, 'B');
  assert.ok(r.sources[0]!.nFilledDays >= r.sources[1]!.nFilledDays);
});

test('pettitt: sort by tstaridx', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 8; d++) queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'A', d <= 2 ? 1 : 100));
  for (let d = 1; d <= 8; d++) queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'B', d <= 6 ? 1 : 100));
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN, sort: 'tstaridx' });
  assert.equal(r.sources[0]!.source, 'B');
});

test('pettitt: tStarDay is correct ISO day from tStarIndex', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 8; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'A', d <= 4 ? 100 : 10000));
  }
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  // Expected tStar = 3 (last of "100" days, 0-indexed)
  assert.equal(r.sources[0]!.tStarIndex, 3);
  assert.equal(r.sources[0]!.tStarDay, '2026-04-04');
});

test('pettitt: secondary sort key is source asc on ties', () => {
  const queue: QueueLine[] = [];
  for (const src of ['Z', 'A', 'M']) {
    for (let d = 1; d <= 4; d++) {
      queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, src, 100));
    }
  }
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN, sort: 'tokens' });
  // All flat (same tokens) -> primary tie -> source asc
  assert.equal(r.sources[0]!.source, 'A');
  assert.equal(r.sources[1]!.source, 'M');
  assert.equal(r.sources[2]!.source, 'Z');
});

test('pettitt: report fields are populated and stable', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'A', 100),
    ql('2026-04-02T00:00:00.000Z', 'A', 200),
    ql('2026-04-03T00:00:00.000Z', 'A', 5000),
    ql('2026-04-04T00:00:00.000Z', 'A', 5500),
  ];
  const r = buildDailyTokenPettittChangepoint(queue, {
    generatedAt: GEN,
    since: '2026-03-30T00:00:00.000Z',
    until: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.windowStart, '2026-03-30T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00.000Z');
  assert.equal(r.minDays, 4);
  assert.equal(r.top, 0);
  assert.equal(r.sort, 'tokens');
  assert.equal(r.source, null);
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalTokens, 10800);
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.firstActiveDay, '2026-04-01');
  assert.equal(s.lastActiveDay, '2026-04-04');
  assert.equal(s.flat, false);
  assert.ok(s.pApprox >= 0 && s.pApprox <= 1);
});

test('pettitt: flat-series source surfaces with flat=y', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 5; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'A', 100));
  }
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.flat, true);
  assert.equal(r.sources[0]!.kt, 0);
  assert.equal(r.sources[0]!.tStarDay, null);
});

test('pettitt: meanShift sign matches direction', () => {
  const queueUp: QueueLine[] = [];
  for (let d = 1; d <= 6; d++) queueUp.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'A', d <= 3 ? 10 : 1000));
  const r1 = buildDailyTokenPettittChangepoint(queueUp, { generatedAt: GEN });
  assert.ok(r1.sources[0]!.meanShift > 0);

  const queueDown: QueueLine[] = [];
  for (let d = 1; d <= 6; d++) queueDown.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'B', d <= 3 ? 1000 : 10));
  const r2 = buildDailyTokenPettittChangepoint(queueDown, { generatedAt: GEN });
  assert.ok(r2.sources[0]!.meanShift < 0);
});

test('pettitt: minDays=4 boundary (n=4 OK, n=3 dropped)', () => {
  const queue: QueueLine[] = [];
  // A: 4 days
  for (let d = 1; d <= 4; d++) queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'A', 100 * d));
  // B: 3 days
  for (let d = 1; d <= 3; d++) queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'B', 100 * d));
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
  assert.equal(r.droppedSparseSources, 1);
});

test('pettitt: large clean step is significant (pApprox < 0.05)', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 16; d++) {
    const day = d < 10 ? `2026-04-0${d}` : `2026-04-${d}`;
    queue.push(ql(`${day}T00:00:00.000Z`, 'A', d <= 8 ? 1 : 1000));
  }
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.pApprox < 0.05, `expected significant p, got ${r.sources[0]!.pApprox}`);
});

test('pettitt: window with no rows -> empty', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'A', 100),
    ql('2026-04-02T00:00:00.000Z', 'A', 200),
  ];
  const r = buildDailyTokenPettittChangepoint(queue, {
    generatedAt: GEN,
    since: '2027-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
});

test('pettitt: deterministic across two builds with same input', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 8; d++) queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'A', d * 17));
  for (let d = 1; d <= 8; d++) queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'B', d <= 4 ? 1 : 100));
  const r1 = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  const r2 = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

test('pettitt: total tokens equals sum of source totalTokens', () => {
  const queue: QueueLine[] = [];
  for (const src of ['A', 'B', 'C']) {
    for (let d = 1; d <= 5; d++) queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, src, 13 * d));
  }
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  const sum = r.sources.reduce((acc, s) => acc + s.totalTokens, 0);
  assert.equal(sum, r.totalTokens);
});

test('pettitt: ktNormalized = 0 when flat=true', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 6; d++) queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'A', 42));
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.sources[0]!.ktNormalized, 0);
});

test('pettitt: source name "(unknown)" when source field missing/empty', () => {
  const q: QueueLine[] = [];
  for (let d = 1; d <= 5; d++) {
    q.push({
      source: '',
      model: 'm',
      hour_start: `2026-04-0${d}T00:00:00.000Z`,
      device_id: 'dev',
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 100 * d,
    });
  }
  const r = buildDailyTokenPettittChangepoint(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('pettitt: pApprox monotonically decreases with stronger shifts', () => {
  function build(scale: number) {
    const queue: QueueLine[] = [];
    for (let d = 1; d <= 12; d++) {
      const day = d < 10 ? `2026-04-0${d}` : `2026-04-${d}`;
      queue.push(ql(`${day}T00:00:00.000Z`, 'A', d <= 6 ? 1 : scale));
    }
    return buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  }
  const weak = build(2);
  const mid = build(20);
  const strong = build(2000);
  // KT is rank-based, so once you reach a "fully separated" state
  // additional magnitude does not change KT. We assert non-increase.
  assert.ok(weak.sources[0]!.pApprox >= strong.sources[0]!.pApprox);
  assert.ok(mid.sources[0]!.pApprox >= strong.sources[0]!.pApprox);
});

test('pettitt: hour buckets within a day collapse to one daily total', () => {
  const queue: QueueLine[] = [];
  for (let h = 0; h < 24; h++) {
    const hh = h < 10 ? `0${h}` : `${h}`;
    queue.push(ql(`2026-04-01T${hh}:00:00.000Z`, 'A', 10));
  }
  for (let d = 2; d <= 5; d++) queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'A', 100));
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  // Day 1 = 240 (24*10), Day 2..5 = 100 each
  assert.equal(r.sources[0]!.totalTokens, 240 + 100 * 4);
  assert.equal(r.sources[0]!.nActiveDays, 5);
  assert.equal(r.sources[0]!.nFilledDays, 5);
});

test('pettitt: report respects all dropped counters at once', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'A', 100),
    ql('2026-04-01T00:00:00.000Z', 'A', 0),
    ql('2026-04-01T00:00:00.000Z', 'A', 100),
    ql('2026-04-02T00:00:00.000Z', 'A', 200),
    ql('2026-04-03T00:00:00.000Z', 'A', 300),
    ql('2026-04-04T00:00:00.000Z', 'A', 400),
    ql('2026-04-01T00:00:00.000Z', 'B', 9999),
    ql('2026-04-02T00:00:00.000Z', 'B', 9999),
    ql('2026-04-03T00:00:00.000Z', 'B', 9999),
  ];
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN, source: 'A', minDays: 4 });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.droppedSourceFilter, 3);
  assert.equal(r.sources.length, 1);
});

test('pettitt: monotone decreasing also yields valid summary', () => {
  const v = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const s = pettittSummary(v);
  assert.equal(s.flat, false);
  assert.ok(s.kt > 0);
  assert.ok(s.tStarIndex >= 3 && s.tStarIndex <= 5);
  assert.ok(s.meanShift < 0);
});

test('pettitt: spectralFlatness — N/A here, but ensure no leakage from cusum', () => {
  // Sanity: importing pettitt should not depend on cusum behaviour.
  const s = pettittSummary([1, 1, 1, 5, 5, 5]);
  assert.equal(s.tStarIndex, 2);
});

// ---- refinement: secondary changepoint -----------------------------------

test('pettittSummary: secondary -- single dominant break gives kt2 < kt by guard', () => {
  // Length 20: clean single step at index 9. With guard = max(3, 4) = 4,
  // the secondary at distance 5 from the peak gives a ratio mechanically
  // bounded by (n-2*5)/n = 0.5 for the linear |U[t]| triangle.
  const v = [...Array(10).fill(1), ...Array(10).fill(100)];
  const s = pettittSummary(v);
  assert.equal(s.flat, false);
  assert.ok(s.kt > 0);
  assert.ok(s.kt2OverKt < 0.6, `expected kt2/kt < 0.6 for single break w/ guard, got ratio ${s.kt2OverKt}`);
});

test('pettittSummary: secondary -- two roughly equal regimes gives kt2 close to kt', () => {
  // Length 24: low, high, low (two changepoints at ~7 and ~15).
  const v = [
    ...Array(8).fill(1),
    ...Array(8).fill(100),
    ...Array(8).fill(1),
  ];
  const s = pettittSummary(v);
  assert.equal(s.flat, false);
  assert.ok(s.kt > 0);
  // Both breaks are visible; the secondary outside the guard
  // window of the primary should still be substantial.
  assert.ok(s.kt2 > 0);
  assert.ok(s.kt2OverKt > 0.3, `expected secondary signal for two-regime series, got ratio ${s.kt2OverKt}`);
  // tStar2 should be on the OTHER side of the series.
  assert.ok(s.tStar2Index !== s.tStarIndex);
  assert.ok(Math.abs(s.tStar2Index - s.tStarIndex) >= 4);
});

test('pettittSummary: secondary -- guard window respected', () => {
  // Length 30, single break at index 14: tStar2 must be at least
  // max(3, floor(30/5)) = 6 indices away from primary.
  const v = [...Array(15).fill(1), ...Array(15).fill(100)];
  const s = pettittSummary(v);
  if (s.tStar2Index >= 0) {
    const guard = Math.max(3, Math.floor(30 / 5));
    assert.ok(Math.abs(s.tStar2Index - s.tStarIndex) > guard);
  }
});

test('pettittSummary: secondary -- empty / flat returns kt2=0, tStar2Index=-1', () => {
  const e = pettittSummary([]);
  assert.equal(e.kt2, 0);
  assert.equal(e.kt2OverKt, 0);
  assert.equal(e.tStar2Index, -1);

  const f = pettittSummary([5, 5, 5, 5]);
  assert.equal(f.kt2, 0);
  assert.equal(f.kt2OverKt, 0);
  assert.equal(f.tStar2Index, -1);
});

test('pettittSummary: secondary -- short series may have no candidate', () => {
  // n=4 -> guard = max(3, 0) = 3. With t in {0,1,2}, all are within
  // guard of any tStar -> tStar2Index = -1.
  const v = [1, 1, 100, 100];
  const s = pettittSummary(v);
  assert.equal(s.tStarIndex, 1);
  // Guard window covers everything; expect no secondary.
  assert.equal(s.tStar2Index, -1);
  assert.equal(s.kt2, 0);
});

test('pettittSummary: secondary -- kt2OverKt always in [0,1]', () => {
  const cases: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [1, 100, 1, 100, 1, 100, 1, 100],
    [1, 1, 1, 1, 100, 100, 100, 100],
    [1, 1, 1, 1, 1, 1, 1, 1, 50, 50, 50, 50, 1, 1, 1, 1],
    [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  ];
  for (const v of cases) {
    const s = pettittSummary(v);
    assert.ok(s.kt2OverKt >= 0 && s.kt2OverKt <= 1.0001, `case ${v.join(',')}: ratio ${s.kt2OverKt}`);
  }
});

test('pettitt: builder surfaces secondary fields on report rows', () => {
  const queue: QueueLine[] = [];
  // 24-day low/high/low pattern — should show non-trivial kt2.
  const days: number[] = [
    ...Array(8).fill(1),
    ...Array(8).fill(100),
    ...Array(8).fill(1),
  ];
  for (let d = 0; d < 24; d++) {
    const dt = new Date(Date.UTC(2026, 3, 1 + d));
    queue.push(ql(dt.toISOString(), 'A', days[d]!));
  }
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.ok(s.kt2 > 0);
  assert.ok(s.kt2OverKt > 0.3);
  assert.notEqual(s.tStar2Day, null);
});

test('pettitt: builder sort by kt2overkt desc', () => {
  const queue: QueueLine[] = [];
  // A: two-regime (high kt2/kt)
  const a: number[] = [
    ...Array(7).fill(1),
    ...Array(7).fill(100),
    ...Array(7).fill(1),
  ];
  for (let d = 0; d < 21; d++) {
    const dt = new Date(Date.UTC(2026, 3, 1 + d));
    queue.push(ql(dt.toISOString(), 'A', a[d]!));
  }
  // B: single break (low kt2/kt)
  const b: number[] = [...Array(10).fill(1), ...Array(11).fill(100)];
  for (let d = 0; d < 21; d++) {
    const dt = new Date(Date.UTC(2026, 3, 1 + d));
    queue.push(ql(dt.toISOString(), 'B', b[d]!));
  }
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN, sort: 'kt2overkt' });
  assert.equal(r.sources[0]!.source, 'A');
  assert.ok(r.sources[0]!.kt2OverKt >= r.sources[1]!.kt2OverKt);
});

test('pettitt: tStar2Day matches filledDays[tStar2Index]', () => {
  const queue: QueueLine[] = [];
  const seq: number[] = [
    ...Array(8).fill(1),
    ...Array(8).fill(100),
    ...Array(8).fill(1),
  ];
  for (let d = 0; d < 24; d++) {
    const dt = new Date(Date.UTC(2026, 3, 1 + d));
    queue.push(ql(dt.toISOString(), 'A', seq[d]!));
  }
  const r = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  if (s.tStar2Index >= 0) {
    // First active day = 2026-04-01; tStar2Day should be that + tStar2Index days.
    const expected = new Date(Date.UTC(2026, 3, 1 + s.tStar2Index)).toISOString().slice(0, 10);
    assert.equal(s.tStar2Day, expected);
  }
});

test('pettitt: sort allowed list rejects unknown including the new key typo', () => {
  assert.throws(() => buildDailyTokenPettittChangepoint([], { sort: 'kt2over' as 'tokens' }));
});

test('pettittSummary: kt2OverKt = 0 when tStar2 not found', () => {
  // n=4, single-step; guard=3 -> no candidate.
  const s = pettittSummary([1, 1, 100, 100]);
  assert.equal(s.tStar2Index, -1);
  assert.equal(s.kt2, 0);
  assert.equal(s.kt2OverKt, 0);
});

test('pettitt: refinement determinism (two builds give same refinement fields)', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 30; d++) {
    const dt = new Date(Date.UTC(2026, 3, 1 + d));
    const v = d < 10 ? 5 : d < 20 ? 50 : 5;
    queue.push(ql(dt.toISOString(), 'A', v));
  }
  const r1 = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  const r2 = buildDailyTokenPettittChangepoint(queue, { generatedAt: GEN });
  assert.equal(r1.sources[0]!.kt2, r2.sources[0]!.kt2);
  assert.equal(r1.sources[0]!.tStar2Index, r2.sources[0]!.tStar2Index);
  assert.equal(r1.sources[0]!.kt2OverKt, r2.sources[0]!.kt2OverKt);
});
