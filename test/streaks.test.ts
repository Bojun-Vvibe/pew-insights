import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildStreaks } from '../src/streaks.js';
import type { QueueLine } from '../src/types.js';

function ql(day: string, tokens: number, hour = 12): QueueLine {
  const hh = String(hour).padStart(2, '0');
  return {
    source: 'test',
    model: 'test-model',
    hour_start: `${day}T${hh}:00:00.000Z`,
    device_id: 'd1',
    input_tokens: tokens,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

const ASOF = '2026-04-30T12:00:00.000Z';

test('streaks: rejects lookbackDays < 1', () => {
  assert.throws(() => buildStreaks([], { lookbackDays: 0, asOf: ASOF }));
  assert.throws(() => buildStreaks([], { lookbackDays: -1, asOf: ASOF }));
});

test('streaks: rejects negative minTokens', () => {
  assert.throws(() => buildStreaks([], { minTokens: -1, asOf: ASOF }));
});

test('streaks: empty queue produces a single all-idle run spanning the window', () => {
  const r = buildStreaks([], { lookbackDays: 7, asOf: ASOF });
  assert.equal(r.runs.length, 1);
  assert.equal(r.runs[0]!.state, 'idle');
  assert.equal(r.runs[0]!.length, 7);
  assert.equal(r.activeDays, 0);
  assert.equal(r.idleDays, 7);
  assert.equal(r.activeFraction, 0);
  assert.equal(r.longestActive, null);
  assert.equal(r.longestIdle!.length, 7);
  assert.equal(r.currentRun.state, 'idle');
  assert.equal(r.currentRun.length, 7);
  assert.equal(r.activeRunCount, 0);
  assert.equal(r.medianActiveLength, null);
  assert.equal(r.meanActiveLength, null);
});

test('streaks: all-active window produces one active run', () => {
  const queue: QueueLine[] = [];
  // 5-day window, all days active.
  for (let i = 0; i < 5; i++) {
    const d = new Date('2026-04-26T00:00:00.000Z');
    d.setUTCDate(d.getUTCDate() + i);
    queue.push(ql(d.toISOString().slice(0, 10), 1000));
  }
  const r = buildStreaks(queue, { lookbackDays: 5, asOf: ASOF });
  assert.equal(r.runs.length, 1);
  assert.equal(r.runs[0]!.state, 'active');
  assert.equal(r.runs[0]!.length, 5);
  assert.equal(r.activeDays, 5);
  assert.equal(r.idleDays, 0);
  assert.equal(r.activeFraction, 1);
  assert.equal(r.longestActive!.length, 5);
  assert.equal(r.longestIdle, null);
  assert.equal(r.currentRun.state, 'active');
  assert.equal(r.currentRun.length, 5);
  assert.equal(r.activeRunCount, 1);
  assert.equal(r.medianActiveLength, 5);
  assert.equal(r.meanActiveLength, 5);
});

test('streaks: alternating active/idle days produce one run per day', () => {
  // window: 6 days. days 0,2,4 active; 1,3,5 idle.
  const queue: QueueLine[] = [];
  const start = new Date('2026-04-25T00:00:00.000Z');
  for (let i = 0; i < 6; i++) {
    if (i % 2 === 0) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      queue.push(ql(d.toISOString().slice(0, 10), 100));
    }
  }
  const r = buildStreaks(queue, { lookbackDays: 6, asOf: ASOF });
  assert.equal(r.runs.length, 6);
  for (const run of r.runs) assert.equal(run.length, 1);
  assert.equal(r.activeDays, 3);
  assert.equal(r.idleDays, 3);
  assert.equal(r.activeRunCount, 3);
  assert.equal(r.medianActiveLength, 1);
  assert.equal(r.meanActiveLength, 1);
});

test('streaks: longest active is picked over a shorter one (tie -> earlier)', () => {
  // 12-day window ending at asOf=2026-04-30 → starts 2026-04-19.
  // Lay out exactly: active(4) idle(1) active(2) idle(1) active(4)
  // → indices 0..3 active, 4 idle, 5..6 active, 7 idle, 8..11 active.
  const queue: QueueLine[] = [];
  const start = new Date('2026-04-19T00:00:00.000Z');
  const activeIdx = [0, 1, 2, 3, 5, 6, 8, 9, 10, 11];
  for (const i of activeIdx) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    queue.push(ql(d.toISOString().slice(0, 10), 50));
  }
  const r = buildStreaks(queue, { lookbackDays: 12, asOf: ASOF });
  // Sanity: window aligns.
  assert.equal(r.windowStart, '2026-04-19');
  assert.equal(r.windowEnd, '2026-04-30');
  // Runs: active(4) idle(1) active(2) idle(1) active(4)
  assert.equal(r.runs.length, 5);
  assert.equal(r.runs[0]!.length, 4);
  assert.equal(r.runs[0]!.state, 'active');
  assert.equal(r.runs[4]!.length, 4);
  assert.equal(r.runs[4]!.state, 'active');
  // Earlier of the tied length-4 runs wins.
  assert.equal(r.longestActive!.startDay, r.runs[0]!.startDay);
  assert.equal(r.longestActive!.length, 4);
  assert.equal(r.activeRunCount, 3);
  // Active lengths = [4, 2, 4]; sorted = [2, 4, 4]; median = 4.
  assert.equal(r.medianActiveLength, 4);
  assert.equal(r.meanActiveLength, (4 + 2 + 4) / 3);
});

test('streaks: currentRun reflects state on the most-recent day', () => {
  // Active for first 3 days, then idle for last 4.
  const queue: QueueLine[] = [];
  const start = new Date('2026-04-24T00:00:00.000Z');
  for (let i = 0; i < 3; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    queue.push(ql(d.toISOString().slice(0, 10), 100));
  }
  // asOf = day index 6 (7-day window 24..30).
  const r = buildStreaks(queue, { lookbackDays: 7, asOf: ASOF });
  assert.equal(r.currentRun.state, 'idle');
  assert.equal(r.currentRun.length, 4);
  assert.equal(r.runs.length, 2);
  assert.equal(r.runs[0]!.state, 'active');
  assert.equal(r.runs[0]!.length, 3);
});

test('streaks: minTokens threshold reclassifies low-token days as idle', () => {
  // 3-day window: day 0 has 50, day 1 has 5000, day 2 has 100.
  const queue: QueueLine[] = [
    ql('2026-04-28', 50),
    ql('2026-04-29', 5000),
    ql('2026-04-30', 100),
  ];
  // Default minTokens=1: all 3 active.
  const rDefault = buildStreaks(queue, { lookbackDays: 3, asOf: ASOF });
  assert.equal(rDefault.activeDays, 3);
  // minTokens=1000: only day 1 active.
  const rHigh = buildStreaks(queue, { lookbackDays: 3, minTokens: 1000, asOf: ASOF });
  assert.equal(rHigh.activeDays, 1);
  assert.equal(rHigh.idleDays, 2);
  assert.equal(rHigh.runs.length, 3);
  assert.equal(rHigh.longestActive!.length, 1);
  assert.equal(rHigh.longestActive!.startDay, '2026-04-29');
});

test('streaks: window aggregation sums tokens within a run', () => {
  // 2 active days back-to-back, each with 2 events.
  const queue: QueueLine[] = [
    ql('2026-04-29', 100, 8),
    ql('2026-04-29', 200, 14),
    ql('2026-04-30', 300, 9),
    ql('2026-04-30', 400, 15),
  ];
  const r = buildStreaks(queue, { lookbackDays: 2, asOf: ASOF });
  assert.equal(r.runs.length, 1);
  assert.equal(r.runs[0]!.state, 'active');
  assert.equal(r.runs[0]!.tokens, 1000);
  assert.equal(r.runs[0]!.startDay, '2026-04-29');
  assert.equal(r.runs[0]!.endDay, '2026-04-30');
});

test('streaks: events outside lookback window are ignored', () => {
  // Way-old event shouldn't enter the report.
  const queue: QueueLine[] = [
    ql('2025-01-01', 1_000_000),
    ql('2026-04-30', 500),
  ];
  const r = buildStreaks(queue, { lookbackDays: 3, asOf: ASOF });
  // window is 2026-04-28..2026-04-30. Days 28,29 idle, 30 active.
  assert.equal(r.activeDays, 1);
  assert.equal(r.idleDays, 2);
  assert.equal(r.runs.length, 2);
  assert.equal(r.runs[0]!.state, 'idle');
  assert.equal(r.runs[0]!.length, 2);
  assert.equal(r.runs[1]!.state, 'active');
});

test('streaks: median with even-count active runs averages the two middle values', () => {
  // 4 active runs of lengths 1, 3, 5, 7 (separated by idle days).
  // Window: 1A 1I 3A 1I 5A 1I 7A = 19 days. lookback=19.
  const queue: QueueLine[] = [];
  const start = new Date('2026-04-12T00:00:00.000Z');
  // active day idx blocks
  const activeIdx = [
    0,
    2, 3, 4,
    6, 7, 8, 9, 10,
    12, 13, 14, 15, 16, 17, 18,
  ];
  for (const i of activeIdx) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    queue.push(ql(d.toISOString().slice(0, 10), 100));
  }
  const r = buildStreaks(queue, { lookbackDays: 19, asOf: ASOF });
  assert.equal(r.activeRunCount, 4);
  // Lengths sorted = [1,3,5,7]; median = (3+5)/2 = 4.
  assert.equal(r.medianActiveLength, 4);
  assert.equal(r.meanActiveLength, 16 / 4);
});

test('streaks: window boundary days are inclusive on both ends', () => {
  // lookback=5 with asOf 2026-04-30 → 04-26..04-30 inclusive.
  const r = buildStreaks(
    [ql('2026-04-26', 1), ql('2026-04-30', 1)],
    { lookbackDays: 5, asOf: ASOF },
  );
  assert.equal(r.windowStart, '2026-04-26');
  assert.equal(r.windowEnd, '2026-04-30');
  assert.equal(r.activeDays, 2);
  assert.equal(r.idleDays, 3);
  // runs: active(1) idle(3) active(1).
  assert.equal(r.runs.length, 3);
});

test('streaks: minTokens=0 makes every day active (0 >= 0)', () => {
  // Pure stress test: with minTokens=0, even 0-token days qualify.
  const r = buildStreaks([], { lookbackDays: 4, minTokens: 0, asOf: ASOF });
  assert.equal(r.activeDays, 4);
  assert.equal(r.idleDays, 0);
  assert.equal(r.runs.length, 1);
  assert.equal(r.runs[0]!.state, 'active');
});
