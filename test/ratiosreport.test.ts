import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  aggregateCacheTokensByDay,
  buildRatiosReport,
} from '../src/ratiosreport.ts';
import type { QueueLine } from '../src/types.ts';

function q(
  hour: string,
  input: number,
  cached: number,
  opts: { model?: string; source?: string } = {},
): QueueLine {
  return {
    source: opts.source ?? 'cli',
    model: opts.model ?? 'gpt-5.4',
    hour_start: hour,
    device_id: 'd1',
    input_tokens: input,
    cached_input_tokens: cached,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: input,
  };
}

// Anchor everything at this UTC date so day-grid math is deterministic.
const ASOF = '2026-04-30T12:00:00.000Z';

// ---------------------------------------------------------------------------
// aggregateCacheTokensByDay
// ---------------------------------------------------------------------------

test('aggregate: sums input + cached per UTC day', () => {
  const queue: QueueLine[] = [
    q('2026-04-20T01:00:00Z', 100, 30),
    q('2026-04-20T05:00:00Z', 200, 80),
    q('2026-04-21T02:00:00Z', 50, 5),
  ];
  const m = aggregateCacheTokensByDay(queue);
  assert.deepEqual(m.get('2026-04-20'), { inputTokens: 300, cachedInputTokens: 110 });
  assert.deepEqual(m.get('2026-04-21'), { inputTokens: 50, cachedInputTokens: 5 });
});

test('aggregate: empty queue → empty map', () => {
  assert.equal(aggregateCacheTokensByDay([]).size, 0);
});

test('aggregate: missing input/cached treated as 0', () => {
  // Force cached_input_tokens = 0 path
  const queue: QueueLine[] = [q('2026-04-20T01:00:00Z', 100, 0)];
  const m = aggregateCacheTokensByDay(queue);
  assert.equal(m.get('2026-04-20')!.cachedInputTokens, 0);
});

// ---------------------------------------------------------------------------
// buildRatiosReport — option validation
// ---------------------------------------------------------------------------

test('validation: lookbackDays < 1 throws', () => {
  assert.throws(() => buildRatiosReport([], { lookbackDays: 0, asOf: ASOF }));
});
test('validation: alpha out of range throws', () => {
  assert.throws(() => buildRatiosReport([], { alpha: 0, asOf: ASOF }));
  assert.throws(() => buildRatiosReport([], { alpha: 1.1, asOf: ASOF }));
});
test('validation: baselineDays < 1 throws', () => {
  assert.throws(() => buildRatiosReport([], { baselineDays: 0, asOf: ASOF }));
});
test('validation: threshold <= 0 throws', () => {
  assert.throws(() => buildRatiosReport([], { threshold: 0, asOf: ASOF }));
});

// ---------------------------------------------------------------------------
// buildRatiosReport — series shape
// ---------------------------------------------------------------------------

test('series: length matches lookbackDays exactly', () => {
  const r = buildRatiosReport([], { lookbackDays: 14, asOf: ASOF });
  assert.equal(r.series.length, 14);
});

test('series: oldest → newest, last day is asOf UTC date', () => {
  const r = buildRatiosReport([], { lookbackDays: 5, asOf: ASOF });
  assert.equal(r.series[r.series.length - 1]!.day, '2026-04-30');
  assert.equal(r.series[0]!.day, '2026-04-26');
});

test('series: empty queue → all undefined, no flagged, no recentHigh/Low', () => {
  const r = buildRatiosReport([], { lookbackDays: 10, asOf: ASOF });
  assert.ok(r.series.every((d) => d.status === 'undefined'));
  assert.equal(r.flagged.length, 0);
  assert.equal(r.recentHigh, false);
  assert.equal(r.recentLow, false);
  assert.equal(r.currentEwma, null);
});

// ---------------------------------------------------------------------------
// EWMA + ratio computation
// ---------------------------------------------------------------------------

test('ratio: input_tokens=0 → ratio null, status undefined', () => {
  const queue: QueueLine[] = [q('2026-04-30T01:00:00Z', 0, 0)];
  const r = buildRatiosReport(queue, { lookbackDays: 1, asOf: ASOF });
  assert.equal(r.series[0]!.ratio, null);
  assert.equal(r.series[0]!.status, 'undefined');
  assert.equal(r.series[0]!.ewma, null);
});

test('ratio: single defined day → ewma equals that ratio', () => {
  // input=75, cached=25 → ratio = 25 / (75 + 25) = 0.25.
  const queue: QueueLine[] = [q('2026-04-30T01:00:00Z', 75, 25)];
  const r = buildRatiosReport(queue, { lookbackDays: 1, asOf: ASOF });
  assert.equal(r.series[0]!.ratio, 0.25);
  assert.ok(Math.abs(r.series[0]!.ewma! - 0.25) < 1e-9);
});

test('ratio: stable series → EWMA converges to that ratio', () => {
  // Seven days of ratio = 40 / (60 + 40) = 0.4.
  const queue: QueueLine[] = [];
  for (let i = 0; i < 7; i++) {
    const day = `2026-04-${String(24 + i).padStart(2, '0')}`;
    queue.push(q(`${day}T01:00:00Z`, 60, 40));
  }
  const r = buildRatiosReport(queue, {
    lookbackDays: 7,
    alpha: 0.5,
    asOf: ASOF,
  });
  const last = r.series[r.series.length - 1]!.ewma!;
  assert.ok(Math.abs(last - 0.4) < 1e-6, `ewma ${last} should be ~0.4`);
});

test('ratio: undefined day in middle → EWMA carries forward, no decay', () => {
  // Pattern: 0.4, undefined, 0.4 — middle day should report the
  // carried-forward EWMA, not null.
  const queue: QueueLine[] = [
    q('2026-04-28T01:00:00Z', 100, 40),
    // 2026-04-29: no events at all
    q('2026-04-30T01:00:00Z', 100, 40),
  ];
  const r = buildRatiosReport(queue, {
    lookbackDays: 3,
    alpha: 0.5,
    asOf: ASOF,
  });
  assert.equal(r.series[0]!.day, '2026-04-28');
  assert.ok(r.series[0]!.ewma != null);
  assert.equal(r.series[1]!.day, '2026-04-29');
  assert.equal(r.series[1]!.ratio, null);
  assert.equal(r.series[1]!.status, 'undefined');
  // EWMA carries forward to the undefined day.
  assert.ok(r.series[1]!.ewma != null);
  assert.ok(Math.abs(r.series[1]!.ewma! - r.series[0]!.ewma!) < 1e-9);
});

// ---------------------------------------------------------------------------
// Drift scoring
// ---------------------------------------------------------------------------

test('warmup: not enough trailing days → status warmup, z=null', () => {
  // 3 days of data, baseline=7 → all warmup
  const queue: QueueLine[] = [];
  for (let i = 0; i < 3; i++) {
    const day = `2026-04-${String(28 + i).padStart(2, '0')}`;
    queue.push(q(`${day}T01:00:00Z`, 100, 40));
  }
  const r = buildRatiosReport(queue, {
    lookbackDays: 3,
    baselineDays: 7,
    asOf: ASOF,
  });
  assert.ok(r.series.every((d) => d.status === 'warmup' || d.status === 'undefined'));
  assert.ok(r.series.every((d) => d.z == null));
});

test('flat: perfectly stable baseline → status flat, z=null', () => {
  // 14 days of identical ratio. After the first 7-day baseline window
  // fills, σ in logit-space is 0 → flat.
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i++) {
    const day = `2026-04-${String(17 + i).padStart(2, '0')}`;
    queue.push(q(`${day}T01:00:00Z`, 100, 40));
  }
  const r = buildRatiosReport(queue, {
    lookbackDays: 14,
    baselineDays: 7,
    alpha: 1.0, // makes EWMA = today's value, so baseline really is constant
    asOf: ASOF,
  });
  // Days 8..14 (indices 7..13) should be `flat` — baseline of 7
  // identical values has σ = 0.
  const scored = r.series.slice(7);
  assert.ok(
    scored.every((d) => d.status === 'flat'),
    `expected all flat, got ${scored.map((d) => d.status).join(',')}`,
  );
  assert.equal(r.recentHigh, false);
  assert.equal(r.recentLow, false);
});

test('low: cache-hit drops sharply → flags low days during the transition', () => {
  // 10 days at 0.95, then 5 days at 0.5. Early in the drop, the
  // baseline (still mostly 0.95 with σ near 0) makes the z-score
  // huge → low. By the last few days, the EWMA has converged and
  // the baseline window has admitted enough drift to shrink z back
  // toward `normal` — that's the correct decay-to-new-regime
  // behavior, not a bug.
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i++) {
    const day = `2026-04-${String(16 + i).padStart(2, '0')}`;
    queue.push(q(`${day}T01:00:00Z`, 100, 95));
  }
  for (let i = 0; i < 5; i++) {
    const day = `2026-04-${String(26 + i).padStart(2, '0')}`;
    queue.push(q(`${day}T01:00:00Z`, 100, 50));
  }
  const r = buildRatiosReport(queue, {
    lookbackDays: 15,
    baselineDays: 7,
    alpha: 0.5,
    threshold: 2.0,
    asOf: ASOF,
  });
  const lowDays = r.series.filter((d) => d.status === 'low');
  assert.ok(
    lowDays.length >= 1,
    `expected at least one low day during transition, got ${r.series.map((d) => d.status).join(',')}`,
  );
  // No high days in a pure drop scenario.
  assert.equal(r.series.filter((d) => d.status === 'high').length, 0);
});

test('high: cache-hit climbs sharply → flags high days during the transition', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i++) {
    const day = `2026-04-${String(16 + i).padStart(2, '0')}`;
    queue.push(q(`${day}T01:00:00Z`, 100, 30));
  }
  for (let i = 0; i < 5; i++) {
    const day = `2026-04-${String(26 + i).padStart(2, '0')}`;
    queue.push(q(`${day}T01:00:00Z`, 100, 90));
  }
  const r = buildRatiosReport(queue, {
    lookbackDays: 15,
    baselineDays: 7,
    alpha: 0.5,
    threshold: 2.0,
    asOf: ASOF,
  });
  const highDays = r.series.filter((d) => d.status === 'high');
  assert.ok(highDays.length >= 1, 'expected at least one high day during transition');
  assert.equal(r.series.filter((d) => d.status === 'low').length, 0);
});

test('boundary: ratio exactly 1.0 → clamped, no Infinity in EWMA', () => {
  // input=0, cached=100 → ratio = 100/(0+100) = 1.0.
  const queue: QueueLine[] = [q('2026-04-30T01:00:00Z', 0, 100)];
  const r = buildRatiosReport(queue, { lookbackDays: 1, asOf: ASOF });
  assert.equal(r.series[0]!.ratio, 1);
  assert.ok(Number.isFinite(r.series[0]!.ewma!));
  assert.ok(r.series[0]!.ewma! < 1);
  assert.ok(r.series[0]!.ewma! > 0.999);
});

test('boundary: ratio exactly 0.0 → clamped, no -Infinity in EWMA', () => {
  const queue: QueueLine[] = [q('2026-04-30T01:00:00Z', 100, 0)];
  const r = buildRatiosReport(queue, { lookbackDays: 1, asOf: ASOF });
  assert.ok(Number.isFinite(r.series[0]!.ewma!));
  assert.ok(r.series[0]!.ewma! > 0);
  assert.ok(r.series[0]!.ewma! < 0.001);
});

// ---------------------------------------------------------------------------
// recentHigh / recentLow walk-back semantics
// ---------------------------------------------------------------------------

test('recent: trailing undefined days do not suppress earlier flagged day', () => {
  // Mildly varying baseline (so σ in logit space is nonzero), then a
  // sharp drop, then 2 days of no events. The drop must still surface
  // as recentLow even though the very last entries are undefined.
  const queue: QueueLine[] = [];
  const baselineRatios = [0.50, 0.52, 0.48, 0.51, 0.49, 0.53, 0.50];
  for (let i = 0; i < baselineRatios.length; i++) {
    const day = `2026-04-${String(21 + i).padStart(2, '0')}`;
    queue.push(q(`${day}T01:00:00Z`, 100, Math.round(baselineRatios[i]! * 100)));
  }
  // day 8: sharp drop
  queue.push(q('2026-04-28T01:00:00Z', 100, 5));
  // days 9-10: no events
  const r = buildRatiosReport(queue, {
    lookbackDays: 10,
    baselineDays: 7,
    alpha: 0.7,
    threshold: 2.0,
    asOf: ASOF,
  });
  // Last two days are undefined (no events).
  assert.equal(r.series[r.series.length - 1]!.status, 'undefined');
  assert.equal(r.series[r.series.length - 2]!.status, 'undefined');
  // recentLow walks back past trailing undefined days and surfaces
  // the drop.
  assert.equal(r.recentLow, true);
});

test('recent: a drop on the most recent day → recentLow=true and exit signal', () => {
  // Mild variation in baseline + sharp drop on the most recent day.
  const queue: QueueLine[] = [];
  const baselineRatios = [0.50, 0.52, 0.48, 0.51, 0.49, 0.53, 0.50, 0.51];
  for (let i = 0; i < baselineRatios.length; i++) {
    const day = `2026-04-${String(22 + i).padStart(2, '0')}`;
    queue.push(q(`${day}T01:00:00Z`, 100, Math.round(baselineRatios[i]! * 100)));
  }
  queue.push(q('2026-04-30T01:00:00Z', 100, 5));
  const r = buildRatiosReport(queue, {
    lookbackDays: 9,
    baselineDays: 7,
    alpha: 0.7,
    threshold: 2.0,
    asOf: ASOF,
  });
  assert.equal(r.series[r.series.length - 1]!.status, 'low');
  assert.equal(r.recentLow, true);
  assert.equal(r.recentHigh, false);
});

test('recent: a normal day after a flagged day clears recent', () => {
  // 7 stable @ 0.5, 1 drop @ 0.05, several recovery days back at 0.5.
  // After enough recovery the EWMA returns near baseline → most
  // recent scored day should be `normal`, not `low`.
  const queue: QueueLine[] = [];
  for (let i = 0; i < 7; i++) {
    const day = `2026-04-${String(14 + i).padStart(2, '0')}`;
    queue.push(q(`${day}T01:00:00Z`, 100, 50));
  }
  queue.push(q('2026-04-21T01:00:00Z', 100, 5));
  for (let i = 0; i < 9; i++) {
    const day = `2026-04-${String(22 + i).padStart(2, '0')}`;
    queue.push(q(`${day}T01:00:00Z`, 100, 50));
  }
  const r = buildRatiosReport(queue, {
    lookbackDays: 17,
    baselineDays: 7,
    alpha: 0.7,
    threshold: 2.0,
    asOf: ASOF,
  });
  // Final EWMA should be back near baseline ratio (50/(100+50) = 0.333).
  assert.ok(
    Math.abs(r.currentEwma! - 1 / 3) < 0.05,
    `currentEwma ${r.currentEwma} should be near 0.333`,
  );
  // Recent flags should be cleared after recovery.
  assert.equal(r.recentLow, false);
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test('determinism: same inputs → same outputs', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i++) {
    const day = `2026-04-${String(17 + i).padStart(2, '0')}`;
    queue.push(q(`${day}T01:00:00Z`, 100, 30 + i * 2));
  }
  const a = buildRatiosReport(queue, { lookbackDays: 14, asOf: ASOF });
  const b = buildRatiosReport(queue, { lookbackDays: 14, asOf: ASOF });
  assert.deepEqual(a, b);
});
