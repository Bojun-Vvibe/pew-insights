import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asciiSparkline,
  buildDailySeries,
  buildTrend,
  sumTokensInRange,
} from '../src/trend.ts';
import type { QueueLine } from '../src/types.ts';

function q(o: Partial<QueueLine>): QueueLine {
  return {
    source: 'claude-code',
    model: 'claude-opus-4.7',
    hour_start: '2026-04-20T12:00:00.000Z',
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0,
    ...o,
  };
}

test('asciiSparkline: empty input → empty string', () => {
  assert.equal(asciiSparkline([]), '');
});

test('asciiSparkline: constant series renders as baseline (no NaN)', () => {
  const s = asciiSparkline([5, 5, 5, 5]);
  assert.equal(s.length, 4);
  // All chars equal — implementation falls to lowest block.
  assert.equal(new Set(s).size, 1);
});

test('asciiSparkline: monotonically increasing series ends at the tallest block', () => {
  const s = asciiSparkline([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(s.length, 8);
  assert.equal(s[0], '▁');
  assert.equal(s[s.length - 1], '█');
});

test('asciiSparkline: handles negatives and zeros without crashing', () => {
  const s = asciiSparkline([-3, 0, 3]);
  assert.equal(s.length, 3);
  assert.equal(s[0], '▁');
  assert.equal(s[2], '█');
});

test('buildDailySeries: pads missing days with zeros, length = days', () => {
  const queue: QueueLine[] = [
    q({ hour_start: '2026-04-18T01:00:00.000Z', total_tokens: 100 }),
    q({ hour_start: '2026-04-20T03:00:00.000Z', total_tokens: 200 }),
  ];
  const series = buildDailySeries(queue, '2026-04-20', 5);
  assert.equal(series.length, 5);
  assert.equal(series[0]!.day, '2026-04-16');
  assert.equal(series[4]!.day, '2026-04-20');
  // Day 18 has 100, day 20 has 200, others 0.
  const map = Object.fromEntries(series.map((s) => [s.day, s.tokens]));
  assert.equal(map['2026-04-16'], 0);
  assert.equal(map['2026-04-17'], 0);
  assert.equal(map['2026-04-18'], 100);
  assert.equal(map['2026-04-19'], 0);
  assert.equal(map['2026-04-20'], 200);
});

test('sumTokensInRange: half-open [from, until) inclusion', () => {
  const queue: QueueLine[] = [
    q({ hour_start: '2026-04-20T11:00:00.000Z', total_tokens: 1 }),
    q({ hour_start: '2026-04-20T12:00:00.000Z', total_tokens: 10 }),
    q({ hour_start: '2026-04-20T13:00:00.000Z', total_tokens: 100 }),
  ];
  const r = sumTokensInRange(
    queue,
    '2026-04-20T12:00:00.000Z',
    '2026-04-20T13:00:00.000Z',
  );
  // 12:00 included (>=), 13:00 excluded (<).
  assert.equal(r.tokens, 10);
  assert.equal(r.events, 1);
});

test('buildTrend: day-over-day arithmetic correct against fixed asOf', () => {
  const asOf = '2026-04-21T00:00:00.000Z';
  // Last 24h: 20T00 → 21T00 → tokens = 200
  // Prior 24h: 19T00 → 20T00 → tokens = 100
  const queue: QueueLine[] = [
    q({ hour_start: '2026-04-19T05:00:00.000Z', total_tokens: 100 }),
    q({ hour_start: '2026-04-20T05:00:00.000Z', total_tokens: 200 }),
  ];
  const r = buildTrend(queue, null, { asOf, windowDays: 4 });
  assert.equal(r.dod.current, 200);
  assert.equal(r.dod.previous, 100);
  assert.equal(r.dod.delta, 100);
  assert.equal(r.dod.pct, 1.0);
});

test('buildTrend: week-over-week comparison uses 7d×2 windows', () => {
  const asOf = '2026-04-21T00:00:00.000Z';
  // Last 7d (14T00 → 21T00): 1000.
  // Prior 7d (07T00 → 14T00): 500.
  const queue: QueueLine[] = [
    q({ hour_start: '2026-04-09T05:00:00.000Z', total_tokens: 500 }),
    q({ hour_start: '2026-04-15T05:00:00.000Z', total_tokens: 1000 }),
  ];
  const r = buildTrend(queue, null, { asOf, windowDays: 14 });
  assert.equal(r.wow.current, 1000);
  assert.equal(r.wow.previous, 500);
  assert.equal(r.wow.pct, 1.0);
});

test('buildTrend: pct=null when previous window is zero (avoid div-by-zero)', () => {
  const asOf = '2026-04-21T00:00:00.000Z';
  const queue: QueueLine[] = [
    q({ hour_start: '2026-04-20T05:00:00.000Z', total_tokens: 50 }),
  ];
  const r = buildTrend(queue, null, { asOf, windowDays: 4 });
  assert.equal(r.dod.previous, 0);
  assert.equal(r.dod.pct, null);
});

test('buildTrend: sparkline length matches window days', () => {
  const asOf = '2026-04-21T00:00:00.000Z';
  const queue: QueueLine[] = [
    q({ hour_start: '2026-04-20T05:00:00.000Z', total_tokens: 50 }),
  ];
  const r = buildTrend(queue, null, { asOf, windowDays: 7 });
  assert.equal(r.series.length, 7);
  assert.equal(r.sparkline.length, 7);
});

test('buildTrend: byModel splits current vs previous half of window', () => {
  const asOf = '2026-04-21T00:00:00.000Z';
  // windowDays=14 → split at 7d back (2026-04-14T00).
  const queue: QueueLine[] = [
    q({ model: 'claude-opus-4.7', hour_start: '2026-04-10T00:00:00.000Z', total_tokens: 100 }),
    q({ model: 'claude-opus-4.7', hour_start: '2026-04-18T00:00:00.000Z', total_tokens: 300 }),
    q({ model: 'gpt-5.4',          hour_start: '2026-04-15T00:00:00.000Z', total_tokens: 50 }),
  ];
  const r = buildTrend(queue, null, { asOf, windowDays: 14 });
  const opus = r.byModel.find((m) => m.model === 'claude-opus-4.7')!;
  assert.equal(opus.previous, 100);
  assert.equal(opus.current, 300);
  assert.equal(opus.delta, 200);
});
