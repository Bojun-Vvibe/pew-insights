import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildHourOfDayTokenSkew } from '../src/hourofdaytokenskew.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  total_tokens: number,
  opts: Partial<QueueLine> = {},
): QueueLine {
  return {
    source: opts.source ?? 's1',
    model: opts.model ?? 'm1',
    hour_start,
    device_id: opts.device_id ?? 'd1',
    input_tokens: opts.input_tokens ?? Math.floor(total_tokens / 2),
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? Math.floor(total_tokens / 2),
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

test('hour-of-day-token-skew: empty input → zero rows', () => {
  const r = buildHourOfDayTokenSkew([], { generatedAt: GEN });
  assert.equal(r.totalTokens, 0);
  assert.equal(r.observedHours, 0);
  assert.equal(r.hours.length, 0);
  assert.equal(r.weightedMeanAbsSkewness, 0);
  assert.equal(r.unweightedMeanSkewness, 0);
  assert.equal(r.highlySkewedHourCount, 0);
});

test('hour-of-day-token-skew: rejects bad minDays', () => {
  assert.throws(() => buildHourOfDayTokenSkew([], { minDays: 0 }));
  assert.throws(() => buildHourOfDayTokenSkew([], { minDays: 1 }));
  assert.throws(() => buildHourOfDayTokenSkew([], { minDays: 2.5 }));
  assert.throws(() => buildHourOfDayTokenSkew([], { minDays: Number.NaN }));
});

test('hour-of-day-token-skew: rejects bad since/until', () => {
  assert.throws(() => buildHourOfDayTokenSkew([], { since: 'not-iso' }));
  assert.throws(() => buildHourOfDayTokenSkew([], { until: 'not-iso' }));
});

test('hour-of-day-token-skew: rejects bad topK', () => {
  assert.throws(() => buildHourOfDayTokenSkew([], { topK: 0 }));
  assert.throws(() => buildHourOfDayTokenSkew([], { topK: -1 }));
  assert.throws(() => buildHourOfDayTokenSkew([], { topK: 1.5 }));
});

test('hour-of-day-token-skew: ignores invalid hour_start and zero/negative tokens', () => {
  const queue: QueueLine[] = [
    ql('not-an-iso', 100),
    ql('2026-04-20T09:00:00Z', 0),
    ql('2026-04-20T09:00:00Z', -5),
    ql('2026-04-20T09:00:00Z', 100),
    ql('2026-04-21T09:00:00Z', 200),
  ];
  const r = buildHourOfDayTokenSkew(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.totalTokens, 300);
  assert.equal(r.observedHours, 1);
  assert.equal(r.hours[0]!.observedDays, 2);
});

test('hour-of-day-token-skew: symmetric vector → skew ≈ 0', () => {
  // Hour 09 across 3 days, perfectly symmetric: 100, 200, 300.
  // mean=200, m2 = (100^2+0+100^2)/3 = 20000/3, m3 = ((-100)^3+0+100^3)/3 = 0
  // -> skew = 0.
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 100),
    ql('2026-04-21T09:00:00Z', 200),
    ql('2026-04-22T09:00:00Z', 300),
  ];
  const r = buildHourOfDayTokenSkew(queue, { generatedAt: GEN });
  assert.equal(r.hours.length, 1);
  const row = r.hours[0]!;
  assert.equal(row.hour, 9);
  assert.equal(row.observedDays, 3);
  assert.equal(row.totalTokens, 600);
  assert.equal(row.meanDailyTokens, 200);
  assert.ok(Math.abs(row.skewness) < 1e-9, `expected ~0 skew, got ${row.skewness}`);
  assert.equal(row.maxDailyTokens, 300);
  assert.equal(row.minDailyTokens, 100);
});

test('hour-of-day-token-skew: right-skewed vector → positive skew', () => {
  // 1, 1, 1, 1, 100 → strongly right-skewed (rare burst pattern).
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 1),
    ql('2026-04-21T09:00:00Z', 1),
    ql('2026-04-22T09:00:00Z', 1),
    ql('2026-04-23T09:00:00Z', 1),
    ql('2026-04-24T09:00:00Z', 100),
  ];
  const r = buildHourOfDayTokenSkew(queue, { generatedAt: GEN });
  assert.equal(r.hours.length, 1);
  const row = r.hours[0]!;
  assert.equal(row.observedDays, 5);
  assert.ok(row.skewness > 1.4, `expected strongly positive skew, got ${row.skewness}`);
  // For [1,1,1,1,100]: mean=20.8, m2 = sum((x-mean)^2)/5
  //   = (4 * 19.8^2 + 79.2^2) / 5 = (4*392.04 + 6272.64)/5 = 7840.8/5 = 1568.16
  //   stddev = ~39.6
  assert.ok(Math.abs(row.stddevDailyTokens - Math.sqrt(1568.16)) < 1e-6);
  assert.equal(r.highlySkewedHourCount, 1);
});

test('hour-of-day-token-skew: left-skewed vector → negative skew', () => {
  // 100, 100, 100, 100, 1 → mirror of the right-skew case.
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 100),
    ql('2026-04-21T09:00:00Z', 100),
    ql('2026-04-22T09:00:00Z', 100),
    ql('2026-04-23T09:00:00Z', 100),
    ql('2026-04-24T09:00:00Z', 1),
  ];
  const r = buildHourOfDayTokenSkew(queue, { generatedAt: GEN });
  const row = r.hours[0]!;
  assert.ok(row.skewness < -1.4, `expected strongly negative skew, got ${row.skewness}`);
  assert.equal(r.highlySkewedHourCount, 1);
});

test('hour-of-day-token-skew: minDays floor drops sparse hours', () => {
  // Hour 09: 1 day. Hour 10: 3 days.
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 100),
    ql('2026-04-20T10:00:00Z', 100),
    ql('2026-04-21T10:00:00Z', 200),
    ql('2026-04-22T10:00:00Z', 300),
  ];
  const r = buildHourOfDayTokenSkew(queue, { minDays: 2, generatedAt: GEN });
  assert.equal(r.observedHours, 2);
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.hours.length, 1);
  assert.equal(r.hours[0]!.hour, 10);
});

test('hour-of-day-token-skew: same hour on same day aggregates tokens', () => {
  // Two rows at 2026-04-20T09:30 (different sources both land in hour 09 on
  // the same UTC date) → 1 day, totalTokens summed.
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 100, { source: 'a' }),
    ql('2026-04-20T09:00:00Z', 50, { source: 'b' }),
    ql('2026-04-21T09:00:00Z', 200),
  ];
  const r = buildHourOfDayTokenSkew(queue, { generatedAt: GEN });
  assert.equal(r.hours.length, 1);
  assert.equal(r.hours[0]!.observedDays, 2);
  assert.equal(r.hours[0]!.totalTokens, 350);
  // per-day vector is [150, 200] → mean 175, m2 = (25^2 + 25^2)/2 = 625, stddev 25
  assert.equal(r.hours[0]!.stddevDailyTokens, 25);
});

test('hour-of-day-token-skew: window filter applies before aggregation', () => {
  const queue: QueueLine[] = [
    ql('2026-04-19T09:00:00Z', 999), // before window
    ql('2026-04-20T09:00:00Z', 100),
    ql('2026-04-21T09:00:00Z', 200),
    ql('2026-04-22T09:00:00Z', 999), // at/after window
  ];
  const r = buildHourOfDayTokenSkew(queue, {
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-22T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.totalTokens, 300);
  assert.equal(r.hours[0]!.observedDays, 2);
});

test('hour-of-day-token-skew: topK caps display but rollup is invariant', () => {
  // 3 hours with different |skew|. Symmetric, mildly right, strongly right.
  const queue: QueueLine[] = [
    // hour 08: symmetric [100, 200, 300] → skew 0
    ql('2026-04-20T08:00:00Z', 100),
    ql('2026-04-21T08:00:00Z', 200),
    ql('2026-04-22T08:00:00Z', 300),
    // hour 09: mildly right [10, 20, 60] → positive skew
    ql('2026-04-20T09:00:00Z', 10),
    ql('2026-04-21T09:00:00Z', 20),
    ql('2026-04-22T09:00:00Z', 60),
    // hour 10: strongly right [1,1,1,1,100]
    ql('2026-04-20T10:00:00Z', 1),
    ql('2026-04-21T10:00:00Z', 1),
    ql('2026-04-22T10:00:00Z', 1),
    ql('2026-04-23T10:00:00Z', 1),
    ql('2026-04-24T10:00:00Z', 100),
  ];
  const noCap = buildHourOfDayTokenSkew(queue, { generatedAt: GEN });
  const capped = buildHourOfDayTokenSkew(queue, { topK: 1, generatedAt: GEN });
  assert.equal(noCap.hours.length, 3);
  assert.equal(capped.hours.length, 1);
  assert.equal(capped.droppedBelowTopK, 2);
  assert.equal(capped.hours[0]!.hour, 10); // strongest |skew|
  // rollup invariance:
  assert.equal(noCap.weightedMeanAbsSkewness, capped.weightedMeanAbsSkewness);
  assert.equal(noCap.unweightedMeanSkewness, capped.unweightedMeanSkewness);
  assert.equal(noCap.highlySkewedHourCount, capped.highlySkewedHourCount);
});

test('hour-of-day-token-skew: default sort is |skew| desc → tokens desc → hour asc', () => {
  // Two hours with identical |skew| (mirror images), different tokens.
  // Hour 09: [1,1,1,1,100] → skew ~+1.5, total 104
  // Hour 10: [100,100,100,100,1] → skew ~-1.5, total 401
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 1),
    ql('2026-04-21T09:00:00Z', 1),
    ql('2026-04-22T09:00:00Z', 1),
    ql('2026-04-23T09:00:00Z', 1),
    ql('2026-04-24T09:00:00Z', 100),
    ql('2026-04-20T10:00:00Z', 100),
    ql('2026-04-21T10:00:00Z', 100),
    ql('2026-04-22T10:00:00Z', 100),
    ql('2026-04-23T10:00:00Z', 100),
    ql('2026-04-24T10:00:00Z', 1),
  ];
  const r = buildHourOfDayTokenSkew(queue, { generatedAt: GEN });
  assert.equal(r.hours.length, 2);
  // |skew| identical, tokens 401 > 104 → hour 10 first.
  assert.equal(r.hours[0]!.hour, 10);
  assert.equal(r.hours[1]!.hour, 9);
});
