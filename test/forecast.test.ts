import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  buildForecast,
  isoWeekEnd,
  isoWeekStart,
  olsFit,
} from '../src/forecast.ts';
import type { QueueLine } from '../src/types.ts';

function q(hour: string, total: number, model = 'gpt-5.4', source = 'cli'): QueueLine {
  return {
    source,
    model,
    hour_start: hour,
    device_id: 'd1',
    input_tokens: total,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

// ---------------------------------------------------------------------------
// olsFit
// ---------------------------------------------------------------------------

test('olsFit: empty input returns zero fit', () => {
  const fit = olsFit([]);
  assert.equal(fit.slope, 0);
  assert.equal(fit.intercept, 0);
  assert.equal(fit.sse, 0);
});

test('olsFit: perfect line y=2x+1 recovers exact slope/intercept', () => {
  const ys = [1, 3, 5, 7, 9, 11, 13];
  const fit = olsFit(ys);
  assert.ok(Math.abs(fit.slope - 2) < 1e-9, `slope=${fit.slope}`);
  assert.ok(Math.abs(fit.intercept - 1) < 1e-9, `intercept=${fit.intercept}`);
  assert.ok(fit.sse < 1e-18, `sse=${fit.sse}`);
});

test('olsFit: flat line has zero slope', () => {
  const fit = olsFit([5, 5, 5, 5, 5]);
  assert.equal(fit.slope, 0);
  assert.equal(fit.intercept, 5);
});

test('olsFit: noisy data still produces finite slope', () => {
  const fit = olsFit([10, 20, 15, 25, 30, 28, 35]);
  assert.ok(Number.isFinite(fit.slope));
  assert.ok(fit.slope > 0, 'expected positive trend');
});

test('olsFit: descending data has negative slope', () => {
  const fit = olsFit([100, 90, 80, 70, 60]);
  assert.ok(fit.slope < 0);
  assert.ok(Math.abs(fit.slope - -10) < 1e-9);
});

// ---------------------------------------------------------------------------
// ISO week boundaries
// ---------------------------------------------------------------------------

test('isoWeekStart: Wednesday returns Monday of same week', () => {
  // 2026-04-22 is a Wednesday.
  assert.equal(isoWeekStart(new Date('2026-04-22T12:00:00Z')), '2026-04-20');
});

test('isoWeekStart: Sunday returns Monday of same ISO week (the prior Monday)', () => {
  // 2026-04-26 is a Sunday → ISO week Monday = 2026-04-20.
  assert.equal(isoWeekStart(new Date('2026-04-26T00:00:00Z')), '2026-04-20');
});

test('isoWeekStart: Monday returns itself', () => {
  assert.equal(isoWeekStart(new Date('2026-04-20T00:00:00Z')), '2026-04-20');
});

test('isoWeekEnd: Wednesday returns Sunday of same week', () => {
  assert.equal(isoWeekEnd(new Date('2026-04-22T00:00:00Z')), '2026-04-26');
});

test('isoWeekEnd: Sunday returns itself', () => {
  assert.equal(isoWeekEnd(new Date('2026-04-26T00:00:00Z')), '2026-04-26');
});

// ---------------------------------------------------------------------------
// buildForecast
// ---------------------------------------------------------------------------

test('buildForecast: rejects lookback < 2', () => {
  assert.throws(() => buildForecast([], { lookbackDays: 1 }));
});

test('buildForecast: empty queue → all zero predictions, low confidence', () => {
  const r = buildForecast([], { asOf: '2026-04-22T12:00:00.000Z', lookbackDays: 14 });
  assert.equal(r.tomorrow.predicted, 0);
  assert.equal(r.tomorrow.lower, 0);
  assert.ok(r.lowConfidence, 'expected lowConfidence=true');
  assert.equal(r.weekObserved, 0);
  assert.equal(r.weekProjected, 0);
});

test('buildForecast: tomorrow day is asOf + 1 day (UTC)', () => {
  const r = buildForecast([], { asOf: '2026-04-22T23:30:00.000Z', lookbackDays: 7 });
  assert.equal(r.tomorrow.day, '2026-04-23');
});

test('buildForecast: produces a series of length = lookbackDays', () => {
  const r = buildForecast([], { asOf: '2026-04-22T12:00:00.000Z', lookbackDays: 10 });
  assert.equal(r.history.length, 10);
});

test('buildForecast: linear input recovers near-exact slope', () => {
  // Build queue where day i has tokens = 100 * (i+1), for 10 days ending 2026-04-22.
  const queue: QueueLine[] = [];
  const end = new Date('2026-04-22T12:00:00.000Z');
  for (let i = 0; i < 10; i++) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (9 - i));
    const iso = d.toISOString().slice(0, 13) + ':00:00.000Z';
    queue.push(q(iso, (i + 1) * 100));
  }
  const r = buildForecast(queue, {
    asOf: '2026-04-22T23:00:00.000Z',
    lookbackDays: 10,
  });
  assert.ok(Math.abs(r.slope - 100) < 1, `slope=${r.slope}`);
  // tomorrow ≈ 1100 (extrapolated 11th value).
  assert.ok(Math.abs(r.tomorrow.predicted - 1100) < 5, `tomorrow=${r.tomorrow.predicted}`);
  assert.ok(!r.lowConfidence);
  assert.ok(r.r2 > 0.99);
});

test('buildForecast: CI bounds enclose the predicted value', () => {
  const queue: QueueLine[] = [];
  const end = new Date('2026-04-22T12:00:00.000Z');
  for (let i = 0; i < 14; i++) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (13 - i));
    const iso = d.toISOString().slice(0, 13) + ':00:00.000Z';
    // noisy increasing series
    queue.push(q(iso, 50 + i * 10 + (i % 3) * 5));
  }
  const r = buildForecast(queue, { asOf: '2026-04-22T23:00:00.000Z', lookbackDays: 14 });
  assert.ok(r.tomorrow.lower <= r.tomorrow.predicted);
  assert.ok(r.tomorrow.upper >= r.tomorrow.predicted);
  assert.ok(r.tomorrow.lower >= 0, 'lower bound must clamp to 0');
});

test('buildForecast: weekObserved sums only this UTC-week tokens', () => {
  // Wed 2026-04-22 asOf; this week starts Mon 2026-04-20.
  const queue: QueueLine[] = [
    q('2026-04-19T12:00:00.000Z', 999), // last week — must NOT count
    q('2026-04-20T01:00:00.000Z', 100),
    q('2026-04-21T05:00:00.000Z', 200),
    q('2026-04-22T08:00:00.000Z', 300),
  ];
  const r = buildForecast(queue, { asOf: '2026-04-22T12:00:00.000Z', lookbackDays: 7 });
  assert.equal(r.weekObserved, 600);
});

test('buildForecast: weekRemaining covers tomorrow through Sunday', () => {
  // Wed 2026-04-22 asOf → remaining = Thu, Fri, Sat, Sun = 4 days.
  const r = buildForecast([], { asOf: '2026-04-22T12:00:00.000Z', lookbackDays: 7 });
  assert.equal(r.weekRemaining.length, 4);
  assert.equal(r.weekRemaining[0].day, '2026-04-23');
  assert.equal(r.weekRemaining[3].day, '2026-04-26');
});

test('buildForecast: when asOf is Sunday, weekRemaining is empty', () => {
  const r = buildForecast([], { asOf: '2026-04-26T12:00:00.000Z', lookbackDays: 7 });
  assert.equal(r.weekRemaining.length, 0);
  assert.equal(r.weekProjected, r.weekObserved);
});

test('buildForecast: weekProjected = observed + sum(weekRemaining.predicted)', () => {
  const queue: QueueLine[] = [];
  const end = new Date('2026-04-22T12:00:00.000Z');
  for (let i = 0; i < 14; i++) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (13 - i));
    const iso = d.toISOString().slice(0, 13) + ':00:00.000Z';
    queue.push(q(iso, 1000));
  }
  const r = buildForecast(queue, { asOf: '2026-04-22T23:00:00.000Z', lookbackDays: 14 });
  const sumPred = r.weekRemaining.reduce((a, p) => a + p.predicted, 0);
  assert.ok(Math.abs(r.weekProjected - (r.weekObserved + sumPred)) < 1e-6);
  assert.ok(r.weekProjectedLower <= r.weekProjected);
  assert.ok(r.weekProjectedUpper >= r.weekProjected);
});

test('buildForecast: flat history → slope ≈ 0 and predictions ≈ mean', () => {
  const queue: QueueLine[] = [];
  const end = new Date('2026-04-22T12:00:00.000Z');
  for (let i = 0; i < 14; i++) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (13 - i));
    const iso = d.toISOString().slice(0, 13) + ':00:00.000Z';
    queue.push(q(iso, 500));
  }
  const r = buildForecast(queue, { asOf: '2026-04-22T23:00:00.000Z', lookbackDays: 14 });
  assert.ok(Math.abs(r.slope) < 1e-6);
  assert.ok(Math.abs(r.tomorrow.predicted - 500) < 1e-6);
});
