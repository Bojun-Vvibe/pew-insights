import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenAllanDeviation,
  allanDeviationTau1,
} from '../src/dailytokenallandeviation.js';
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

test('daily-token-allan-deviation: rejects bad minDays', () => {
  assert.throws(() => buildDailyTokenAllanDeviation([], { minDays: 2 }));
  assert.throws(() => buildDailyTokenAllanDeviation([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenAllanDeviation([], { minDays: -1 }));
});

test('daily-token-allan-deviation: rejects bad top', () => {
  assert.throws(() => buildDailyTokenAllanDeviation([], { top: -1 }));
  assert.throws(() => buildDailyTokenAllanDeviation([], { top: 1.5 }));
});

test('daily-token-allan-deviation: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenAllanDeviation([], { sort: 'nope' as 'tokens' }),
  );
});

test('daily-token-allan-deviation: rejects bad since/until', () => {
  assert.throws(() => buildDailyTokenAllanDeviation([], { since: 'no' }));
  assert.throws(() => buildDailyTokenAllanDeviation([], { until: 'nope' }));
});

// ---- empty / sparse --------------------------------------------------------

test('daily-token-allan-deviation: empty input', () => {
  const r = buildDailyTokenAllanDeviation([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minDays, 3);
});

test('daily-token-allan-deviation: source with tenure < minDays is dropped sparse', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T01:00:00.000Z', 'a', 200),
  ];
  const r = buildDailyTokenAllanDeviation(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedSparseSources, 1);
  assert.deepEqual(r.sources, []);
});

// ---- pure helper -----------------------------------------------------------

test('allanDeviationTau1: flat for n<2', () => {
  assert.deepEqual(allanDeviationTau1([]), { allan: 0, flat: true });
  assert.deepEqual(allanDeviationTau1([5]), { allan: 0, flat: true });
});

test('allanDeviationTau1: constant series -> 0', () => {
  const r = allanDeviationTau1([7, 7, 7, 7]);
  assert.equal(r.flat, false);
  assert.equal(r.allan, 0);
});

test('allanDeviationTau1: simple two-point step', () => {
  // (5-3)^2 = 4. sigma_a = sqrt(4 / (2*1)) = sqrt(2)
  const r = allanDeviationTau1([3, 5]);
  assert.equal(r.flat, false);
  assert.ok(Math.abs(r.allan - Math.sqrt(2)) < 1e-12);
});

test('allanDeviationTau1: alternating sequence has higher allan than monotonic', () => {
  // Same marginal stddev, different temporal ordering.
  const alt = allanDeviationTau1([0, 10, 0, 10, 0, 10]);
  const mono = allanDeviationTau1([0, 2, 4, 6, 8, 10]);
  assert.ok(alt.allan > mono.allan);
});

// ---- end-to-end correctness ------------------------------------------------

test('daily-token-allan-deviation: constant 4-day source -> allan=0, flatRwRatio (stddev=0)', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 100),
    ql('2026-04-03T00:00:00.000Z', 'a', 100),
    ql('2026-04-04T00:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenAllanDeviation(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.allanDev, 0);
  assert.equal(s.meanAbsStep, 0);
  assert.equal(s.maxAbsStep, 0);
  assert.equal(s.argMaxStepDay, null); // no positive step -> null
  assert.equal(s.flatRwRatio, true);
  assert.equal(s.randomWalkAllanRatio, 0);
  assert.equal(s.flatRel, false);
  assert.equal(s.allanRel, 0);
});

test('daily-token-allan-deviation: 4-day series formula', () => {
  // [10, 30, 20, 40]: diffs (20, -10, 20) -> sumSq=400+100+400=900
  // sigma_a = sqrt(900 / (2*3)) = sqrt(150)
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 10),
    ql('2026-04-02T00:00:00.000Z', 'a', 30),
    ql('2026-04-03T00:00:00.000Z', 'a', 20),
    ql('2026-04-04T00:00:00.000Z', 'a', 40),
  ];
  const r = buildDailyTokenAllanDeviation(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.allanDev - Math.sqrt(150)) < 1e-9);
  assert.equal(s.maxAbsStep, 20);
  // First i.e. earliest tying landing day -> 2026-04-02 (20-10=20)
  assert.equal(s.argMaxStepDay, '2026-04-02');
  assert.equal(s.nFilledDays, 4);
  assert.equal(s.nActiveDays, 4);
});

test('daily-token-allan-deviation: gap-fill puts zeros between active days', () => {
  // Active on day 1 and day 4, no rows on 2 or 3 -> filled=[100,0,0,200]
  // diffs: -100, 0, 200 -> sumSq=10000+0+40000=50000
  // sigma_a = sqrt(50000 / 6) = sqrt(8333.333...)
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-04T00:00:00.000Z', 'a', 200),
  ];
  const r = buildDailyTokenAllanDeviation(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.nActiveDays, 2);
  assert.equal(s.nFilledDays, 4);
  assert.ok(Math.abs(s.allanDev - Math.sqrt(50000 / 6)) < 1e-9);
  assert.equal(s.maxAbsStep, 200);
  assert.equal(s.argMaxStepDay, '2026-04-04');
});

test('daily-token-allan-deviation: alternating sequence has rwRatio > 1, monotonic has < 1', () => {
  const alt: QueueLine[] = [];
  const mono: QueueLine[] = [];
  for (let d = 1; d <= 8; d++) {
    const day = `2026-04-0${d}T00:00:00.000Z`;
    alt.push(ql(day, 'a', d % 2 === 0 ? 100 : 10));
    mono.push(ql(day, 'b', d * 100));
  }
  const r = buildDailyTokenAllanDeviation([...alt, ...mono], { generatedAt: GEN });
  const a = r.sources.find((s) => s.source === 'a')!;
  const b = r.sources.find((s) => s.source === 'b')!;
  assert.ok(a.randomWalkAllanRatio > 1, `alt rwRatio ${a.randomWalkAllanRatio} should be > 1`);
  assert.ok(b.randomWalkAllanRatio < 1, `mono rwRatio ${b.randomWalkAllanRatio} should be < 1`);
});

test('daily-token-allan-deviation: respects since/until window', () => {
  const queue: QueueLine[] = [
    ql('2026-03-30T00:00:00.000Z', 'a', 999),
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 200),
    ql('2026-04-03T00:00:00.000Z', 'a', 300),
    ql('2026-04-10T00:00:00.000Z', 'a', 999),
  ];
  const r = buildDailyTokenAllanDeviation(queue, {
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-04T00:00:00.000Z',
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.nFilledDays, 3);
  assert.equal(s.totalTokens, 600);
});

test('daily-token-allan-deviation: source filter drops non-matching rows', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 200),
    ql('2026-04-03T00:00:00.000Z', 'a', 300),
    ql('2026-04-01T00:00:00.000Z', 'b', 400),
    ql('2026-04-02T00:00:00.000Z', 'b', 500),
    ql('2026-04-03T00:00:00.000Z', 'b', 600),
  ];
  const r = buildDailyTokenAllanDeviation(queue, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 3);
});

test('daily-token-allan-deviation: drops invalid hour_start and zero/negative tokens', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql('2026-04-01T00:00:00.000Z', 'a', 0),
    ql('2026-04-01T01:00:00.000Z', 'a', -5),
    ql('2026-04-01T02:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 200),
    ql('2026-04-03T00:00:00.000Z', 'a', 300),
  ];
  const r = buildDailyTokenAllanDeviation(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalTokens, 600);
});

test('daily-token-allan-deviation: deterministic source-asc tie-break', () => {
  // Two sources with identical totalTokens.
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'b', 100),
    ql('2026-04-02T00:00:00.000Z', 'b', 100),
    ql('2026-04-03T00:00:00.000Z', 'b', 100),
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 100),
    ql('2026-04-03T00:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenAllanDeviation(queue, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('daily-token-allan-deviation: top cap counts droppedTopSources', () => {
  const rows: QueueLine[] = [];
  for (const src of ['a', 'b', 'c', 'd']) {
    for (let d = 1; d <= 4; d++) {
      const day = `2026-04-0${d}T00:00:00.000Z`;
      const tokens = src === 'd' ? 1000 : src === 'c' ? 500 : src === 'b' ? 200 : 100;
      rows.push(ql(day, src, tokens));
    }
  }
  const r = buildDailyTokenAllanDeviation(rows, { top: 2, generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
  assert.equal(r.sources[0]!.source, 'd');
  assert.equal(r.sources[1]!.source, 'c');
});

test('daily-token-allan-deviation: sort=allan ranks by allanDev desc', () => {
  // Source a: alternating 0/100 -> high allan
  // Source b: monotonic 1..N      -> low allan but same total
  const rows: QueueLine[] = [];
  for (let d = 1; d <= 8; d++) {
    const day = `2026-04-0${d}T00:00:00.000Z`;
    rows.push(ql(day, 'a', d % 2 === 0 ? 100 : 1));
    rows.push(ql(day, 'b', d * 12));
  }
  const r = buildDailyTokenAllanDeviation(rows, { sort: 'allan', generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
  assert.ok(r.sources[0]!.allanDev > r.sources[1]!.allanDev);
});

test('daily-token-allan-deviation: maxAbsStep takes earliest tying landing day', () => {
  // diffs: 100, -100, 100, -100 -> all tie at 100, earliest landing is day 2.
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 0),
    ql('2026-04-02T00:00:00.000Z', 'a', 100),
    ql('2026-04-03T00:00:00.000Z', 'a', 0),
    ql('2026-04-04T00:00:00.000Z', 'a', 100),
    ql('2026-04-05T00:00:00.000Z', 'a', 0),
  ];
  // Note: zero-day rows are dropped at row level if their summed-day is zero.
  // Add a small positive amount on the zero days to keep them active.
  // Actually our active-day floor is per-day; we want this to test the gap-fill side.
  // Easier: keep the zero-tokens days OUT (they get dropped) and rely on gap-fill.
  const r = buildDailyTokenAllanDeviation(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  // Zero-token rows are dropped; active days = 2 and 4. Filled tenure = day2..day4 = 3 days.
  // filled=[100, 0, 100]; diffs=(-100, 100); maxAbs=100; earliest landing idx=1 -> '2026-04-03'.
  assert.equal(s.nActiveDays, 2);
  assert.equal(s.nFilledDays, 3);
  assert.equal(s.maxAbsStep, 100);
  assert.equal(s.argMaxStepDay, '2026-04-03');
});

test('daily-token-allan-deviation: allanRel = allanDev / mean for non-degenerate series', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 10),
    ql('2026-04-02T00:00:00.000Z', 'a', 30),
    ql('2026-04-03T00:00:00.000Z', 'a', 20),
    ql('2026-04-04T00:00:00.000Z', 'a', 40),
  ];
  const r = buildDailyTokenAllanDeviation(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  const expected = s.allanDev / s.mean;
  assert.ok(Math.abs(s.allanRel - expected) < 1e-12);
  assert.equal(s.flatRel, false);
});

test('daily-token-allan-deviation: report echoes options + window', () => {
  const r = buildDailyTokenAllanDeviation([], {
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-30T00:00:00.000Z',
    minDays: 5,
    top: 7,
    sort: 'rwratio',
    source: 'foo',
    generatedAt: GEN,
  });
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00.000Z');
  assert.equal(r.minDays, 5);
  assert.equal(r.top, 7);
  assert.equal(r.sort, 'rwratio');
  assert.equal(r.source, 'foo');
});

test('daily-token-allan-deviation: unknown source bucket', () => {
  const queue: QueueLine[] = [
    { ...ql('2026-04-01T00:00:00.000Z', '', 100), source: '' },
    { ...ql('2026-04-02T00:00:00.000Z', '', 200), source: '' },
    { ...ql('2026-04-03T00:00:00.000Z', '', 300), source: '' },
  ];
  const r = buildDailyTokenAllanDeviation(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('daily-token-allan-deviation: aggregates multiple rows per day', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T01:00:00.000Z', 'a', 50),
    ql('2026-04-01T05:00:00.000Z', 'a', 50),
    ql('2026-04-02T00:00:00.000Z', 'a', 200),
    ql('2026-04-03T00:00:00.000Z', 'a', 300),
  ];
  const r = buildDailyTokenAllanDeviation(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.totalTokens, 600);
  // Day 1 = 100, day 2 = 200, day 3 = 300. diffs: 100, 100. sumSq=20000
  // sigma_a = sqrt(20000 / (2*2)) = sqrt(5000)
  assert.ok(Math.abs(s.allanDev - Math.sqrt(5000)) < 1e-9);
});
