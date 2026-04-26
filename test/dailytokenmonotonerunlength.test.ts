import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDailyTokenMonotoneRunLength } from '../src/dailytokenmonotonerunlength.js';
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

const GEN = '2026-04-26T12:00:00.000Z';

// ---- option validation -----------------------------------------------------

test('daily-token-monotone-run-length: rejects bad minDays', () => {
  assert.throws(() => buildDailyTokenMonotoneRunLength([], { minDays: 1 }));
  assert.throws(() => buildDailyTokenMonotoneRunLength([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenMonotoneRunLength([], { minDays: -1 }));
});

test('daily-token-monotone-run-length: rejects bad top', () => {
  assert.throws(() => buildDailyTokenMonotoneRunLength([], { top: -1 }));
  assert.throws(() => buildDailyTokenMonotoneRunLength([], { top: 1.5 }));
});

test('daily-token-monotone-run-length: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenMonotoneRunLength([], { sort: 'bogus' as never }),
  );
});

test('daily-token-monotone-run-length: rejects bad since/until', () => {
  assert.throws(() => buildDailyTokenMonotoneRunLength([], { since: 'no' }));
  assert.throws(() => buildDailyTokenMonotoneRunLength([], { until: 'nope' }));
});

test('daily-token-monotone-run-length: rejects bad minLongestRun', () => {
  assert.throws(() => buildDailyTokenMonotoneRunLength([], { minLongestRun: -1 }));
  assert.throws(() => buildDailyTokenMonotoneRunLength([], { minLongestRun: 1.5 }));
});

// ---- empty / sparse --------------------------------------------------------

test('daily-token-monotone-run-length: empty input', () => {
  const r = buildDailyTokenMonotoneRunLength([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minDays, 2);
});

test('daily-token-monotone-run-length: source with single active day is dropped sparse', () => {
  const queue: QueueLine[] = [ql('2026-04-01T00:00:00.000Z', 'a', 100)];
  const r = buildDailyTokenMonotoneRunLength(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedSparseSources, 1);
  assert.deepEqual(r.sources, []);
});

// ---- core: monotone math ---------------------------------------------------

test('daily-token-monotone-run-length: strictly increasing -> longestUpRun = nDays', () => {
  const queue: QueueLine[] = [];
  const vals = [100, 200, 300, 400, 500, 600];
  vals.forEach((t, i) => {
    const dd = (i + 1).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'mono', t));
  });
  const r = buildDailyTokenMonotoneRunLength(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 6);
  assert.equal(row.longestUpRun, 6);
  assert.equal(row.longestDownRun, 0);
  assert.equal(row.longestMonotoneRun, 6);
  assert.equal(row.longestDirection, 'up');
  assert.equal(row.longestUpStart, '2026-04-01');
  assert.equal(row.longestUpEnd, '2026-04-06');
  assert.equal(row.longestDownStart, '');
  assert.equal(row.longestDownEnd, '');
  assert.equal(row.currentDirection, 'up');
  assert.equal(row.currentRunLength, 6);
  assert.equal(row.runs, 1);
});

test('daily-token-monotone-run-length: strictly decreasing -> longestDownRun = nDays', () => {
  const queue: QueueLine[] = [];
  const vals = [600, 500, 400, 300, 200, 100];
  vals.forEach((t, i) => {
    const dd = (i + 1).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'down', t));
  });
  const r = buildDailyTokenMonotoneRunLength(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.longestUpRun, 0);
  assert.equal(row.longestDownRun, 6);
  assert.equal(row.longestDirection, 'down');
  assert.equal(row.currentDirection, 'down');
  assert.equal(row.currentRunLength, 6);
  assert.equal(row.runs, 1);
});

test('daily-token-monotone-run-length: alternating high/low -> all runs length 2', () => {
  const queue: QueueLine[] = [];
  const vals = [100, 1000, 100, 1000, 100, 1000];
  vals.forEach((t, i) => {
    const dd = (i + 1).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'zig', t));
  });
  const r = buildDailyTokenMonotoneRunLength(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.longestUpRun, 2);
  assert.equal(row.longestDownRun, 2);
  assert.equal(row.longestMonotoneRun, 2);
  // up wins on tie
  assert.equal(row.longestDirection, 'up');
  assert.equal(row.runs, 5);
});

test('daily-token-monotone-run-length: flat series -> no runs, currentDirection flat', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 5; d++) {
    const dd = d.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'flat', 100));
  }
  const r = buildDailyTokenMonotoneRunLength(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.longestUpRun, 0);
  assert.equal(row.longestDownRun, 0);
  assert.equal(row.longestMonotoneRun, 0);
  assert.equal(row.longestDirection, 'flat');
  assert.equal(row.currentDirection, 'flat');
  assert.equal(row.currentRunLength, 5);
  assert.equal(row.runs, 0);
});

test('daily-token-monotone-run-length: climb then fall -> finds both runs, current is down', () => {
  // values: 100, 200, 300, 400, 250, 150, 50  (4-day up then 4-day down)
  const queue: QueueLine[] = [];
  const vals = [100, 200, 300, 400, 250, 150, 50];
  vals.forEach((t, i) => {
    const dd = (i + 1).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'arc', t));
  });
  const r = buildDailyTokenMonotoneRunLength(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.longestUpRun, 4); // 100->200->300->400 (4 days)
  assert.equal(row.longestUpStart, '2026-04-01');
  assert.equal(row.longestUpEnd, '2026-04-04');
  assert.equal(row.longestDownRun, 4); // 400->250->150->50 (4 days)
  assert.equal(row.longestDownStart, '2026-04-04');
  assert.equal(row.longestDownEnd, '2026-04-07');
  assert.equal(row.longestMonotoneRun, 4);
  // tie -> up wins
  assert.equal(row.longestDirection, 'up');
  assert.equal(row.currentDirection, 'down');
  assert.equal(row.currentRunLength, 4);
  assert.equal(row.runs, 2);
});

test('daily-token-monotone-run-length: equal-valued neighbors break runs', () => {
  // 100, 200, 200, 300 -> two runs of length 2 (100,200) and (200,300), separated by flat
  const queue: QueueLine[] = [];
  const vals = [100, 200, 200, 300];
  vals.forEach((t, i) => {
    const dd = (i + 1).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'eq', t));
  });
  const r = buildDailyTokenMonotoneRunLength(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.longestUpRun, 2);
  assert.equal(row.runs, 2);
  // current trailing pair is 200->300 -> up
  assert.equal(row.currentDirection, 'up');
  assert.equal(row.currentRunLength, 2);
});

test('daily-token-monotone-run-length: trailing flat tail counted as flat with length', () => {
  // 100, 200, 300, 300, 300 -> trailing flat of 3
  const queue: QueueLine[] = [];
  const vals = [100, 200, 300, 300, 300];
  vals.forEach((t, i) => {
    const dd = (i + 1).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'tail', t));
  });
  const r = buildDailyTokenMonotoneRunLength(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.currentDirection, 'flat');
  assert.equal(row.currentRunLength, 3);
  assert.equal(row.longestUpRun, 3); // 100->200->300
});

// ---- aggregation across rows -----------------------------------------------

test('daily-token-monotone-run-length: aggregates multiple buckets per day', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's', 50),
    ql('2026-04-01T12:00:00.000Z', 's', 50), // day 1: 100
    ql('2026-04-02T00:00:00.000Z', 's', 200), // day 2: 200
    ql('2026-04-03T00:00:00.000Z', 's', 300), // day 3: 300
  ];
  const r = buildDailyTokenMonotoneRunLength(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 3);
  assert.equal(row.longestUpRun, 3);
  assert.equal(row.totalTokens, 600);
});

// ---- filters ---------------------------------------------------------------

test('daily-token-monotone-run-length: source filter drops other sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'keep', 100),
    ql('2026-04-02T00:00:00.000Z', 'keep', 200),
    ql('2026-04-01T00:00:00.000Z', 'drop', 100),
    ql('2026-04-02T00:00:00.000Z', 'drop', 200),
  ];
  const r = buildDailyTokenMonotoneRunLength(queue, {
    generatedAt: GEN,
    source: 'keep',
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 2);
});

test('daily-token-monotone-run-length: since/until window filter', () => {
  const queue: QueueLine[] = [
    ql('2026-03-30T00:00:00.000Z', 's', 100), // before
    ql('2026-04-01T00:00:00.000Z', 's', 200),
    ql('2026-04-02T00:00:00.000Z', 's', 300),
    ql('2026-04-03T00:00:00.000Z', 's', 400),
    ql('2026-04-10T00:00:00.000Z', 's', 999), // after
  ];
  const r = buildDailyTokenMonotoneRunLength(queue, {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-04T00:00:00.000Z',
  });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 3);
  assert.equal(row.longestUpRun, 3);
  assert.equal(row.totalTokens, 900);
});

test('daily-token-monotone-run-length: drops zero/negative tokens and bad hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's', 100),
    ql('2026-04-01T00:00:00.000Z', 's', 0),
    ql('2026-04-01T00:00:00.000Z', 's', -5),
    ql('2026-04-02T00:00:00.000Z', 's', 100),
    ql('2026-04-03T00:00:00.000Z', 's', 200),
  ];
  const r = buildDailyTokenMonotoneRunLength(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.sources[0]!.nActiveDays, 2);
});

// ---- sort & top ------------------------------------------------------------

test('daily-token-monotone-run-length: sort=longest orders by longestMonotoneRun desc', () => {
  const queue: QueueLine[] = [
    // src 'a' = 5-day climb
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 200),
    ql('2026-04-03T00:00:00.000Z', 'a', 300),
    ql('2026-04-04T00:00:00.000Z', 'a', 400),
    ql('2026-04-05T00:00:00.000Z', 'a', 500),
    // src 'b' = bigger tokens but only 2-day
    ql('2026-04-01T00:00:00.000Z', 'b', 1_000_000),
    ql('2026-04-02T00:00:00.000Z', 'b', 2_000_000),
  ];
  const r = buildDailyTokenMonotoneRunLength(queue, {
    generatedAt: GEN,
    sort: 'longest',
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('daily-token-monotone-run-length: sort=tokens (default) puts heavier source first', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 200),
    ql('2026-04-01T00:00:00.000Z', 'b', 1_000_000),
    ql('2026-04-02T00:00:00.000Z', 'b', 2_000_000),
  ];
  const r = buildDailyTokenMonotoneRunLength(queue, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[1]!.source, 'a');
});

test('daily-token-monotone-run-length: top cap drops trailing rows', () => {
  const queue: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    queue.push(ql('2026-04-01T00:00:00.000Z', s, 100));
    queue.push(ql('2026-04-02T00:00:00.000Z', s, 200));
  }
  const r = buildDailyTokenMonotoneRunLength(queue, {
    generatedAt: GEN,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.totalSources, 3);
});

test('daily-token-monotone-run-length: minLongestRun display filter', () => {
  const queue: QueueLine[] = [
    // 'big' = 5-day climb (longest=5)
    ql('2026-04-01T00:00:00.000Z', 'big', 100),
    ql('2026-04-02T00:00:00.000Z', 'big', 200),
    ql('2026-04-03T00:00:00.000Z', 'big', 300),
    ql('2026-04-04T00:00:00.000Z', 'big', 400),
    ql('2026-04-05T00:00:00.000Z', 'big', 500),
    // 'small' = zigzag (longest=2)
    ql('2026-04-01T00:00:00.000Z', 'small', 100),
    ql('2026-04-02T00:00:00.000Z', 'small', 200),
    ql('2026-04-03T00:00:00.000Z', 'small', 100),
    ql('2026-04-04T00:00:00.000Z', 'small', 200),
  ];
  const r = buildDailyTokenMonotoneRunLength(queue, {
    generatedAt: GEN,
    minLongestRun: 3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinLongestRun, 1);
  // global denominators reflect full population
  assert.equal(r.totalSources, 2);
});

test('daily-token-monotone-run-length: deterministic on tie -> source asc secondary', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'b', 100),
    ql('2026-04-02T00:00:00.000Z', 'b', 200),
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 200),
  ];
  const r = buildDailyTokenMonotoneRunLength(queue, {
    generatedAt: GEN,
    sort: 'longest',
  });
  // both have longest=2, ties -> source asc
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});
