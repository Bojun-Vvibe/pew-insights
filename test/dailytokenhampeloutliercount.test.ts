import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenHampelOutlierCount,
  populationMedian,
  medianAbsoluteDeviation,
  hampelOutlierSummary,
} from '../src/dailytokenhampeloutliercount.js';
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

// ---- option validation -----------------------------------------------------

test('hampel: rejects bad k', () => {
  assert.throws(() => buildDailyTokenHampelOutlierCount([], { k: 0 }));
  assert.throws(() => buildDailyTokenHampelOutlierCount([], { k: -1 }));
  assert.throws(() => buildDailyTokenHampelOutlierCount([], { k: Number.NaN }));
  assert.throws(() => buildDailyTokenHampelOutlierCount([], { k: Infinity }));
});

test('hampel: rejects bad minDays', () => {
  assert.throws(() => buildDailyTokenHampelOutlierCount([], { minDays: 2 }));
  assert.throws(() => buildDailyTokenHampelOutlierCount([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenHampelOutlierCount([], { minDays: -1 }));
});

test('hampel: rejects bad top', () => {
  assert.throws(() => buildDailyTokenHampelOutlierCount([], { top: -1 }));
  assert.throws(() => buildDailyTokenHampelOutlierCount([], { top: 1.5 }));
});

test('hampel: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenHampelOutlierCount([], { sort: 'nope' as 'tokens' }),
  );
});

test('hampel: rejects bad since/until', () => {
  assert.throws(() => buildDailyTokenHampelOutlierCount([], { since: 'no' }));
  assert.throws(() => buildDailyTokenHampelOutlierCount([], { until: 'nope' }));
});

// ---- pure helpers ----------------------------------------------------------

test('populationMedian: empty -> 0', () => {
  assert.equal(populationMedian([]), 0);
});

test('populationMedian: single value', () => {
  assert.equal(populationMedian([7]), 7);
});

test('populationMedian: odd n', () => {
  assert.equal(populationMedian([3, 1, 2]), 2);
  assert.equal(populationMedian([10, 20, 30, 40, 50]), 30);
});

test('populationMedian: even n averages two middles', () => {
  assert.equal(populationMedian([1, 2, 3, 4]), 2.5);
  assert.equal(populationMedian([10, 20, 30, 40]), 25);
});

test('medianAbsoluteDeviation: constant series -> 0', () => {
  assert.equal(medianAbsoluteDeviation([5, 5, 5, 5]), 0);
});

test('medianAbsoluteDeviation: empty -> 0', () => {
  assert.equal(medianAbsoluteDeviation([]), 0);
});

test('medianAbsoluteDeviation: known fixture', () => {
  // values [1,1,2,2,4,6,9] median=2; abs devs [1,1,0,0,2,4,7] median=1
  assert.equal(medianAbsoluteDeviation([1, 1, 2, 2, 4, 6, 9]), 1);
});

test('hampelOutlierSummary: empty -> flat all zero', () => {
  const s = hampelOutlierSummary([], 3);
  assert.equal(s.flat, true);
  assert.equal(s.nOut, 0);
  assert.equal(s.maxScore, 0);
  assert.equal(s.argMaxIndex, -1);
});

test('hampelOutlierSummary: constant series -> flat (MAD=0)', () => {
  const s = hampelOutlierSummary([10, 10, 10, 10, 10], 3);
  assert.equal(s.flat, true);
  assert.equal(s.median, 10);
  assert.equal(s.mad, 0);
  assert.equal(s.sigmaHat, 0);
  assert.equal(s.nOut, 0);
});

test('hampelOutlierSummary: detects single huge spike (median/MAD survive it)', () => {
  // 10 ones plus one 1000 -> median=1, MAD=0
  // because 6 of 11 deviations are 0. So flat.
  const s = hampelOutlierSummary([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1000], 3);
  // MAD is 0 here -> flat fallback. Hampel CANNOT score in this
  // degenerate case (which is honest).
  assert.equal(s.flat, true);
  assert.equal(s.median, 1);
});

test('hampelOutlierSummary: detects spike when MAD > 0', () => {
  // Mixed series so MAD > 0
  const s = hampelOutlierSummary([1, 2, 3, 4, 5, 6, 7, 8, 9, 100], 3);
  assert.equal(s.flat, false);
  assert.ok(s.median >= 5 && s.median <= 6);
  assert.ok(s.mad > 0);
  assert.equal(s.nHigh, 1);
  assert.equal(s.nLow, 0);
  assert.equal(s.nOut, 1);
  assert.equal(s.argMaxIndex, 9);
});

test('hampelOutlierSummary: detects low outlier', () => {
  const s = hampelOutlierSummary([100, 95, 105, 98, 102, 99, 101, 0], 3);
  assert.equal(s.flat, false);
  assert.equal(s.nLow, 1);
  assert.equal(s.argMaxIndex, 7);
});

test('hampelOutlierSummary: high k -> fewer outliers', () => {
  const series = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
  const k3 = hampelOutlierSummary(series, 3);
  const k20 = hampelOutlierSummary(series, 20);
  assert.ok(k3.nOut >= k20.nOut);
});

test('hampelOutlierSummary: order-invariant (permutation-invariant)', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
  const b = [100, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const sa = hampelOutlierSummary(a, 3);
  const sb = hampelOutlierSummary(b, 3);
  assert.equal(sa.median, sb.median);
  assert.equal(sa.mad, sb.mad);
  assert.equal(sa.nOut, sb.nOut);
  assert.equal(sa.maxScore, sb.maxScore);
});

// ---- empty / sparse --------------------------------------------------------

test('hampel: empty input', () => {
  const r = buildDailyTokenHampelOutlierCount([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.k, 3.0);
  assert.equal(r.minDays, 3);
  assert.equal(r.sort, 'tokens');
  assert.equal(r.generatedAt, GEN);
});

test('hampel: source with tenure < minDays is dropped sparse', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 200),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedSparseSources, 1);
  assert.deepEqual(r.sources, []);
});

// ---- end-to-end correctness ------------------------------------------------

test('hampel: constant 5-day source -> flat, nOut=0', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 100),
    ql('2026-04-03T00:00:00.000Z', 'a', 100),
    ql('2026-04-04T00:00:00.000Z', 'a', 100),
    ql('2026-04-05T00:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.flat, true);
  assert.equal(s.nOut, 0);
  assert.equal(s.maxScore, 0);
  assert.equal(s.argMaxScoreDay, null);
  assert.equal(s.median, 100);
  assert.equal(s.mad, 0);
  assert.equal(s.sigmaHat, 0);
});

test('hampel: single spike against varied background flagged once', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 1),
    ql('2026-04-02T00:00:00.000Z', 'a', 2),
    ql('2026-04-03T00:00:00.000Z', 'a', 3),
    ql('2026-04-04T00:00:00.000Z', 'a', 4),
    ql('2026-04-05T00:00:00.000Z', 'a', 5),
    ql('2026-04-06T00:00:00.000Z', 'a', 6),
    ql('2026-04-07T00:00:00.000Z', 'a', 7),
    ql('2026-04-08T00:00:00.000Z', 'a', 8),
    ql('2026-04-09T00:00:00.000Z', 'a', 9),
    ql('2026-04-10T00:00:00.000Z', 'a', 1000),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.flat, false);
  assert.equal(s.nHigh, 1);
  assert.equal(s.nLow, 0);
  assert.equal(s.nOut, 1);
  assert.equal(s.argMaxScoreDay, '2026-04-10');
  assert.ok(s.outFraction > 0 && s.outFraction <= 0.1 + 1e-9);
});

test('hampel: gap-fill creates low outliers from a single huge spike', () => {
  // Source active days: day1=100 day10=100 only. Tenure = 10.
  // Filled = [100, 0,0,0,0,0,0,0,0, 100]. median=0, MAD=0 -> flat.
  // Test ensures gap-fill happens (nFilledDays = 10, not 2).
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-10T00:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.nFilledDays, 10);
  assert.equal(s.nActiveDays, 2);
  assert.equal(s.flat, true);
});

test('hampel: gap-fill flags spike when enough active background exists', () => {
  // 7 active days clustered in 7 contiguous calendar days, then a gap then a huge spike.
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 50),
    ql('2026-04-02T00:00:00.000Z', 'a', 60),
    ql('2026-04-03T00:00:00.000Z', 'a', 55),
    ql('2026-04-04T00:00:00.000Z', 'a', 52),
    ql('2026-04-05T00:00:00.000Z', 'a', 58),
    ql('2026-04-06T00:00:00.000Z', 'a', 51),
    ql('2026-04-07T00:00:00.000Z', 'a', 59),
    ql('2026-04-08T00:00:00.000Z', 'a', 5000),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.flat, false);
  assert.equal(s.nHigh, 1);
  assert.equal(s.argMaxScoreDay, '2026-04-08');
});

test('hampel: window since/until filter applied', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 100),
    ql('2026-04-03T00:00:00.000Z', 'a', 100),
    ql('2026-04-04T00:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, {
    generatedAt: GEN,
    since: '2026-04-02T00:00:00.000Z',
    until: '2026-04-04T00:00:00.000Z',
  });
  // kept days: 04-02, 04-03 -> only 2 active days, tenure = 2 < min 3
  assert.equal(r.droppedSparseSources, 1);
  assert.deepEqual(r.sources, []);
});

test('hampel: source filter drops non-matching rows', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 100),
    ql('2026-04-03T00:00:00.000Z', 'a', 100),
    ql('2026-04-01T00:00:00.000Z', 'b', 50),
    ql('2026-04-02T00:00:00.000Z', 'b', 50),
    ql('2026-04-03T00:00:00.000Z', 'b', 50),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 3);
});

test('hampel: invalid hour_start dropped', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 100),
    ql('2026-04-03T00:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('hampel: zero/negative tokens dropped', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 0),
    ql('2026-04-01T00:00:00.000Z', 'a', -5),
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 100),
    ql('2026-04-03T00:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.sources.length, 1);
});

test('hampel: multi-row-per-day aggregation sums', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 50),
    ql('2026-04-01T05:00:00.000Z', 'a', 50),
    ql('2026-04-02T00:00:00.000Z', 'a', 100),
    ql('2026-04-03T00:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.totalTokens, 300);
  assert.equal(s.nActiveDays, 3);
});

test('hampel: source asc tie-break under equal totals', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'b', 100),
    ql('2026-04-02T00:00:00.000Z', 'b', 100),
    ql('2026-04-03T00:00:00.000Z', 'b', 100),
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 100),
    ql('2026-04-03T00:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('hampel: --top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 100),
    ql('2026-04-03T00:00:00.000Z', 'a', 100),
    ql('2026-04-01T00:00:00.000Z', 'b', 200),
    ql('2026-04-02T00:00:00.000Z', 'b', 200),
    ql('2026-04-03T00:00:00.000Z', 'b', 200),
    ql('2026-04-01T00:00:00.000Z', 'c', 300),
    ql('2026-04-02T00:00:00.000Z', 'c', 300),
    ql('2026-04-03T00:00:00.000Z', 'c', 300),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN, top: 1 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.droppedTopSources, 2);
});

test('hampel: --sort nout reorders by outlier count desc', () => {
  // Source 'a': 10 vary days plus one spike -> nOut >= 1
  // Source 'b': 10 constant days -> flat, nOut=0
  // 'b' has more total tokens but should be after 'a' under nout sort.
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 9; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'a', d * 10));
  }
  queue.push(ql('2026-04-10T00:00:00.000Z', 'a', 5000));
  for (let d = 1; d <= 10; d++) {
    const dayStr = d < 10 ? `2026-04-0${d}` : `2026-04-${d}`;
    queue.push(ql(`${dayStr}T00:00:00.000Z`, 'b', 10000));
  }
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN, sort: 'nout' });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.sources[0]!.nOut >= 1);
  assert.equal(r.sources[1]!.source, 'b');
  assert.equal(r.sources[1]!.nOut, 0);
});

test('hampel: --sort frac uses outFraction', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 9; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'a', d * 10));
  }
  queue.push(ql('2026-04-10T00:00:00.000Z', 'a', 5000));
  for (let d = 1; d <= 5; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'b', 10000));
  }
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN, sort: 'frac' });
  assert.equal(r.sources.length, 2);
  // 'a' has nOut > 0 / 10 = 0.1; 'b' is flat -> 0
  assert.equal(r.sources[0]!.source, 'a');
});

test('hampel: --sort maxscore uses maxScore', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 9; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'a', d * 10));
  }
  queue.push(ql('2026-04-10T00:00:00.000Z', 'a', 50000));
  for (let d = 1; d <= 9; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'b', d * 10));
  }
  queue.push(ql('2026-04-10T00:00:00.000Z', 'b', 200));
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN, sort: 'maxscore' });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.sources[0]!.maxScore > r.sources[1]!.maxScore);
});

test('hampel: --sort ndays uses nFilledDays', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 5; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'a', 100));
  }
  for (let d = 1; d <= 10; d++) {
    const dayStr = d < 10 ? `2026-04-0${d}` : `2026-04-${d}`;
    queue.push(ql(`${dayStr}T00:00:00.000Z`, 'b', 100));
  }
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN, sort: 'ndays' });
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[0]!.nFilledDays, 10);
});

test('hampel: report echoes options + window', () => {
  const r = buildDailyTokenHampelOutlierCount([], {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-30T00:00:00.000Z',
    k: 2.5,
    minDays: 5,
    top: 7,
    sort: 'nout',
    source: 'foo',
  });
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00.000Z');
  assert.equal(r.k, 2.5);
  assert.equal(r.minDays, 5);
  assert.equal(r.top, 7);
  assert.equal(r.sort, 'nout');
  assert.equal(r.source, 'foo');
});

test('hampel: unknown source bucket', () => {
  const queue: QueueLine[] = [
    { ...ql('2026-04-01T00:00:00.000Z', '', 100), source: '' },
    { ...ql('2026-04-02T00:00:00.000Z', '', 100), source: '' },
    { ...ql('2026-04-03T00:00:00.000Z', '', 100), source: '' },
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('hampel: earliest tie wins for argMaxScoreDay', () => {
  // Construct so MAD > 0 and two days tie on |x - median|.
  // Series: [100, 95, 105, 100, 95, 105, 200, 0]
  // sorted: [0, 95, 95, 100, 100, 105, 105, 200] -> median = (100+100)/2 = 100
  // |dev|: [0, 5, 5, 0, 5, 5, 100, 100] sorted [0,0,5,5,5,5,100,100]
  // median(devs) = (5+5)/2 = 5. sigmaHat = 7.413. With k=1 day index 6 (200)
  // and 7 (0) both have |dev|=100, score=100/7.413 (tie). Earlier wins.
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 95),
    ql('2026-04-03T00:00:00.000Z', 'a', 105),
    ql('2026-04-04T00:00:00.000Z', 'a', 100),
    ql('2026-04-05T00:00:00.000Z', 'a', 95),
    ql('2026-04-06T00:00:00.000Z', 'a', 105),
    ql('2026-04-07T00:00:00.000Z', 'a', 200),
    ql('2026-04-08T00:00:00.000Z', 'a', 1), // use 1 not 0 (zero gets dropped)
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN, k: 1.0 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.flat, false);
  // |200-100|=100 vs |1-100|=99 -> 200 wins on day 04-07.
  assert.equal(s.argMaxScoreDay, '2026-04-07');
});

test('hampel: outFraction matches nOut/nFilledDays exactly', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 9; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'a', d * 10));
  }
  queue.push(ql('2026-04-10T00:00:00.000Z', 'a', 5000));
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.outFraction - s.nOut / s.nFilledDays) < 1e-12);
});

test('hampel: hi/lo thresholds match med +/- k * sigmaHat', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 9; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'a', d * 10));
  }
  queue.push(ql('2026-04-10T00:00:00.000Z', 'a', 5000));
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN, k: 2.5 });
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.hiThreshold - (s.median + 2.5 * s.sigmaHat)) < 1e-9);
  assert.ok(Math.abs(s.loThreshold - (s.median - 2.5 * s.sigmaHat)) < 1e-9);
});

test('hampel: sigmaHat exactly 1.4826 * MAD', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 9; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'a', d * 10));
  }
  queue.push(ql('2026-04-10T00:00:00.000Z', 'a', 5000));
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.sigmaHat - 1.4826 * s.mad) < 1e-9);
});

test('hampel: nOut equals nHigh + nLow', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 5000),
    ql('2026-04-02T00:00:00.000Z', 'a', 50),
    ql('2026-04-03T00:00:00.000Z', 'a', 60),
    ql('2026-04-04T00:00:00.000Z', 'a', 55),
    ql('2026-04-05T00:00:00.000Z', 'a', 58),
    ql('2026-04-06T00:00:00.000Z', 'a', 53),
    ql('2026-04-07T00:00:00.000Z', 'a', 56),
    ql('2026-04-08T00:00:00.000Z', 'a', 1),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.nOut, s.nHigh + s.nLow);
});

test('hampel: changing k strictly monotonic on nOut (non-increasing)', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 9; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'a', d * 10));
  }
  queue.push(ql('2026-04-10T00:00:00.000Z', 'a', 5000));
  const r1 = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN, k: 1 });
  const r3 = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN, k: 3 });
  const r10 = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN, k: 10 });
  assert.ok(r1.sources[0]!.nOut >= r3.sources[0]!.nOut);
  assert.ok(r3.sources[0]!.nOut >= r10.sources[0]!.nOut);
});

test('hampel: deterministic across two builds', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 200),
    ql('2026-04-03T00:00:00.000Z', 'a', 100),
    ql('2026-04-04T00:00:00.000Z', 'a', 5000),
    ql('2026-04-05T00:00:00.000Z', 'a', 100),
  ];
  const r1 = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  const r2 = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

test('hampel: minDays default is 3, gap-fill 3-day series allowed', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 200),
    ql('2026-04-03T00:00:00.000Z', 'a', 50),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nFilledDays, 3);
});

test('hampel: first/last active days reported', () => {
  const queue: QueueLine[] = [
    ql('2026-04-05T00:00:00.000Z', 'a', 100),
    ql('2026-04-10T00:00:00.000Z', 'a', 200),
    ql('2026-04-15T00:00:00.000Z', 'a', 300),
  ];
  const r = buildDailyTokenHampelOutlierCount(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.firstActiveDay, '2026-04-05');
  assert.equal(s.lastActiveDay, '2026-04-15');
  assert.equal(s.nFilledDays, 11);
  assert.equal(s.nActiveDays, 3);
});
