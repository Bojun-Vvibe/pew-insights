import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDailyTokenZscoreExtremes } from '../src/dailytokenzscoreextremes.js';
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

test('daily-token-zscore-extremes: rejects bad minDays', () => {
  assert.throws(() => buildDailyTokenZscoreExtremes([], { minDays: 1 }));
  assert.throws(() => buildDailyTokenZscoreExtremes([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenZscoreExtremes([], { minDays: -1 }));
});

test('daily-token-zscore-extremes: rejects bad sigma', () => {
  assert.throws(() => buildDailyTokenZscoreExtremes([], { sigma: 0 }));
  assert.throws(() => buildDailyTokenZscoreExtremes([], { sigma: -1 }));
  assert.throws(() => buildDailyTokenZscoreExtremes([], { sigma: NaN }));
});

test('daily-token-zscore-extremes: rejects bad top', () => {
  assert.throws(() => buildDailyTokenZscoreExtremes([], { top: -1 }));
  assert.throws(() => buildDailyTokenZscoreExtremes([], { top: 1.5 }));
});

test('daily-token-zscore-extremes: rejects bad sort', () => {
  assert.throws(() => buildDailyTokenZscoreExtremes([], { sort: 'bogus' as never }));
});

test('daily-token-zscore-extremes: rejects bad since/until', () => {
  assert.throws(() => buildDailyTokenZscoreExtremes([], { since: 'no' }));
  assert.throws(() => buildDailyTokenZscoreExtremes([], { until: 'nope' }));
});

// ---- empty / sparse --------------------------------------------------------

test('daily-token-zscore-extremes: empty input', () => {
  const r = buildDailyTokenZscoreExtremes([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minDays, 3);
  assert.equal(r.sigma, 2);
});

test('daily-token-zscore-extremes: source with fewer than minDays active days is dropped sparse', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T01:00:00.000Z', 'a', 200),
  ];
  const r = buildDailyTokenZscoreExtremes(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedSparseSources, 1);
  assert.deepEqual(r.sources, []);
});

// ---- core math -------------------------------------------------------------

test('daily-token-zscore-extremes: flat series -> flat=true, zero extremes, maxAbsZ=0', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 5; d++) {
    const dd = d.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T05:00:00.000Z`, 'flat', 100));
  }
  const r = buildDailyTokenZscoreExtremes(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 5);
  assert.equal(row.flat, true);
  assert.equal(row.stddev, 0);
  assert.equal(row.nHighExtreme, 0);
  assert.equal(row.nLowExtreme, 0);
  assert.equal(row.nExtreme, 0);
  assert.equal(row.maxAbsZ, 0);
  assert.equal(row.maxAbsZDay, '');
  assert.equal(row.maxAbsZDirection, 'flat');
});

test('daily-token-zscore-extremes: detects single high outlier at sigma=2', () => {
  // 4 days at 100, 1 day at 1000. mean=280, stddev = sqrt(((180^2)*4 + 720^2)/5)
  // = sqrt((129600 + 518400)/5) = sqrt(129600) = 360. z for 1000 = 720/360 = 2.0 (NOT strict >2)
  // So sigma=2 strict catches none. sigma=1.5 catches it.
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's', 100),
    ql('2026-04-02T00:00:00.000Z', 's', 100),
    ql('2026-04-03T00:00:00.000Z', 's', 100),
    ql('2026-04-04T00:00:00.000Z', 's', 100),
    ql('2026-04-05T00:00:00.000Z', 's', 1000),
  ];
  const strict = buildDailyTokenZscoreExtremes(queue, { generatedAt: GEN, sigma: 2 });
  assert.equal(strict.sources[0]!.nHighExtreme, 0); // exactly +2 doesn't count (strict)
  const loose = buildDailyTokenZscoreExtremes(queue, { generatedAt: GEN, sigma: 1.5 });
  const row = loose.sources[0]!;
  assert.equal(row.nHighExtreme, 1);
  assert.equal(row.nLowExtreme, 0);
  assert.equal(row.nExtreme, 1);
  assert.equal(row.maxAbsZDay, '2026-04-05');
  assert.equal(row.maxAbsZDirection, 'high');
  assert.equal(row.maxAbsZTokens, 1000);
  assert.ok(Math.abs(row.maxAbsZ - 2.0) < 1e-9);
});

test('daily-token-zscore-extremes: detects low outlier', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's', 1000),
    ql('2026-04-02T00:00:00.000Z', 's', 1000),
    ql('2026-04-03T00:00:00.000Z', 's', 1000),
    ql('2026-04-04T00:00:00.000Z', 's', 1000),
    ql('2026-04-05T00:00:00.000Z', 's', 100),
  ];
  const r = buildDailyTokenZscoreExtremes(queue, { generatedAt: GEN, sigma: 1.5 });
  const row = r.sources[0]!;
  assert.equal(row.nLowExtreme, 1);
  assert.equal(row.nHighExtreme, 0);
  assert.equal(row.maxAbsZDirection, 'low');
  assert.equal(row.maxAbsZDay, '2026-04-05');
});

test('daily-token-zscore-extremes: source filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 200),
    ql('2026-04-03T00:00:00.000Z', 'a', 300),
    ql('2026-04-01T00:00:00.000Z', 'b', 500),
    ql('2026-04-02T00:00:00.000Z', 'b', 500),
    ql('2026-04-03T00:00:00.000Z', 'b', 500),
  ];
  const r = buildDailyTokenZscoreExtremes(queue, { generatedAt: GEN, source: 'a' });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 3);
});

test('daily-token-zscore-extremes: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 1; d <= 4; d++) {
      const dd = d.toString().padStart(2, '0');
      const t = src === 'a' ? 1000 : src === 'b' ? 500 : 100;
      queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, src, t * d));
    }
  }
  const r = buildDailyTokenZscoreExtremes(queue, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('daily-token-zscore-extremes: zero/negative tokens dropped', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T00:00:00.000Z', 'a', 0),
    ql('2026-04-03T00:00:00.000Z', 'a', 200),
    ql('2026-04-04T00:00:00.000Z', 'a', 300),
  ];
  const r = buildDailyTokenZscoreExtremes(queue, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.sources[0]!.nActiveDays, 3);
});

test('daily-token-zscore-extremes: sort by extreme', () => {
  const queue: QueueLine[] = [];
  // a: 4 normal + 1 huge spike -> 1 extreme
  for (let d = 1; d <= 4; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'a', 100));
  }
  queue.push(ql('2026-04-05T00:00:00.000Z', 'a', 10000));
  // b: all flat -> 0 extreme but more tokens
  for (let d = 1; d <= 5; d++) {
    queue.push(ql(`2026-04-0${d}T00:00:00.000Z`, 'b', 5000));
  }
  const r = buildDailyTokenZscoreExtremes(queue, {
    generatedAt: GEN,
    sigma: 1.5,
    sort: 'extreme',
  });
  assert.equal(r.sources[0]!.source, 'a');
});
