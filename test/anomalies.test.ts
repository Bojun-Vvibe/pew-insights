import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildAnomalies, mean, stdDev } from '../src/anomalies.ts';
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
// stats
// ---------------------------------------------------------------------------

test('mean: empty → 0', () => {
  assert.equal(mean([]), 0);
});

test('mean: simple average', () => {
  assert.equal(mean([1, 2, 3, 4, 5]), 3);
});

test('stdDev: n<2 → 0', () => {
  assert.equal(stdDev([]), 0);
  assert.equal(stdDev([42]), 0);
});

test('stdDev: flat → 0', () => {
  assert.equal(stdDev([5, 5, 5, 5, 5]), 0);
});

test('stdDev: known value (Bessel-corrected)', () => {
  // Sample stddev of [2,4,4,4,5,5,7,9] = 2.138... (n-1=7 in denominator)
  const s = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.ok(Math.abs(s - 2.138089935299395) < 1e-9, `got ${s}`);
});

// ---------------------------------------------------------------------------
// buildAnomalies — option validation
// ---------------------------------------------------------------------------

test('buildAnomalies: rejects lookbackDays < 1', () => {
  assert.throws(() => buildAnomalies([], { lookbackDays: 0 }), /lookbackDays/);
});

test('buildAnomalies: rejects baselineDays < 1', () => {
  assert.throws(() => buildAnomalies([], { baselineDays: 0 }), /baselineDays/);
});

test('buildAnomalies: rejects threshold <= 0', () => {
  assert.throws(() => buildAnomalies([], { threshold: 0 }), /threshold/);
  assert.throws(() => buildAnomalies([], { threshold: -1 }), /threshold/);
});

// ---------------------------------------------------------------------------
// buildAnomalies — series shape
// ---------------------------------------------------------------------------

test('buildAnomalies: empty queue → all-zero flat series', () => {
  const r = buildAnomalies([], {
    lookbackDays: 5,
    baselineDays: 3,
    asOf: '2026-04-24T00:00:00.000Z',
  });
  assert.equal(r.series.length, 5);
  // baseline of all zeros → σ=0 → flat
  for (const d of r.series) {
    assert.equal(d.tokens, 0);
    assert.equal(d.baselineStdDev, 0);
    assert.equal(d.status, 'flat');
    assert.equal(d.z, null);
  }
  assert.equal(r.flagged.length, 0);
  assert.equal(r.recentHigh, false);
});

test('buildAnomalies: series ends on asOf day (UTC)', () => {
  const r = buildAnomalies([], {
    lookbackDays: 3,
    baselineDays: 2,
    asOf: '2026-04-24T15:30:00.000Z',
  });
  assert.equal(r.series[r.series.length - 1]!.day, '2026-04-24');
});

test('buildAnomalies: lookbackDays controls visible series length', () => {
  const r = buildAnomalies([], {
    lookbackDays: 10,
    baselineDays: 7,
    asOf: '2026-04-24T00:00:00.000Z',
  });
  assert.equal(r.series.length, 10);
});

// ---------------------------------------------------------------------------
// buildAnomalies — detection
// ---------------------------------------------------------------------------

test('buildAnomalies: detects a clear spike as high', () => {
  // Build 10 days of 1000-token baseline, then one day with a 50k spike.
  const queue: QueueLine[] = [];
  const start = new Date('2026-04-15T00:00:00.000Z');
  for (let i = 0; i < 10; i++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    const iso = day.toISOString().slice(0, 13) + ':00:00.000Z';
    // Mild variance so σ > 0 and z is well-defined.
    queue.push(q(iso, 1000 + (i % 3) * 50));
  }
  // Spike day:
  queue.push(q('2026-04-25T12:00:00.000Z', 50000));

  const r = buildAnomalies(queue, {
    lookbackDays: 5,
    baselineDays: 7,
    threshold: 2.0,
    asOf: '2026-04-25T23:00:00.000Z',
  });
  const spike = r.series.find((d) => d.day === '2026-04-25');
  assert.ok(spike, 'expected entry for spike day');
  assert.equal(spike!.status, 'high');
  assert.ok(spike!.z != null && spike!.z > 2);
  assert.equal(r.recentHigh, true);
  assert.ok(r.flagged.some((d) => d.day === '2026-04-25'));
});

test('buildAnomalies: detects a clear dip as low', () => {
  // 10 days of 5000 then a 0-token day.
  const queue: QueueLine[] = [];
  const start = new Date('2026-04-15T00:00:00.000Z');
  for (let i = 0; i < 10; i++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    // Add some natural variance so σ > 0.
    const variance = (i % 3) * 100; // 0, 100, 200, 0, 100, 200, ...
    const iso = day.toISOString().slice(0, 13) + ':00:00.000Z';
    queue.push(q(iso, 5000 + variance));
  }
  // Then a near-zero day.
  // (no entries for 2026-04-25 → 0 tokens that day)

  const r = buildAnomalies(queue, {
    lookbackDays: 3,
    baselineDays: 7,
    threshold: 2.0,
    asOf: '2026-04-25T23:00:00.000Z',
  });
  const dip = r.series.find((d) => d.day === '2026-04-25');
  assert.ok(dip);
  assert.equal(dip!.tokens, 0);
  assert.equal(dip!.status, 'low');
  assert.ok(dip!.z != null && dip!.z < -2);
  assert.equal(r.recentHigh, false);
});

test('buildAnomalies: normal day stays normal', () => {
  // Mostly-flat baseline with a same-ish day.
  const queue: QueueLine[] = [];
  const start = new Date('2026-04-15T00:00:00.000Z');
  for (let i = 0; i < 11; i++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    const iso = day.toISOString().slice(0, 13) + ':00:00.000Z';
    // Vary 4800-5200 to give a small but nonzero σ.
    queue.push(q(iso, 5000 + ((i % 3) - 1) * 200));
  }
  const r = buildAnomalies(queue, {
    lookbackDays: 3,
    baselineDays: 7,
    threshold: 2.0,
    asOf: '2026-04-25T23:00:00.000Z',
  });
  for (const d of r.series) {
    if (d.status === 'flat') continue;
    assert.equal(d.status, 'normal', `day ${d.day} z=${d.z}`);
  }
  assert.equal(r.flagged.length, 0);
});

test('buildAnomalies: threshold tightening promotes normal → flagged', () => {
  // Construct a ~1.5σ deviation. Should be `normal` at t=2.0,
  // `high` at t=1.0.
  const queue: QueueLine[] = [];
  const start = new Date('2026-04-15T00:00:00.000Z');
  // baseline: 1000, 1100, 900, 1050, 950, 1000, 1100  → mean≈1014, σ≈74
  const baseline = [1000, 1100, 900, 1050, 950, 1000, 1100];
  for (let i = 0; i < baseline.length; i++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    queue.push(q(day.toISOString().slice(0, 13) + ':00:00.000Z', baseline[i]!));
  }
  // anomaly day: 1014 + 1.5*74 ≈ 1125 → z ≈ 1.5
  const anomalyDay = new Date(start);
  anomalyDay.setUTCDate(anomalyDay.getUTCDate() + baseline.length);
  queue.push(q(anomalyDay.toISOString().slice(0, 13) + ':00:00.000Z', 1125));

  const asOf = anomalyDay.toISOString();
  const loose = buildAnomalies(queue, {
    lookbackDays: 1,
    baselineDays: 7,
    threshold: 2.0,
    asOf,
  });
  assert.equal(loose.series[0]!.status, 'normal');

  const tight = buildAnomalies(queue, {
    lookbackDays: 1,
    baselineDays: 7,
    threshold: 1.0,
    asOf,
  });
  assert.equal(tight.series[0]!.status, 'high');
});

test('buildAnomalies: recentHigh only true when LAST scored day is high', () => {
  // Spike 3 days ago, normal today.
  const queue: QueueLine[] = [];
  const start = new Date('2026-04-15T00:00:00.000Z');
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    queue.push(q(day.toISOString().slice(0, 13) + ':00:00.000Z', 1000 + (i % 2) * 100));
  }
  // Big spike day at index 7
  const spikeDay = new Date(start);
  spikeDay.setUTCDate(spikeDay.getUTCDate() + 7);
  queue.push(q(spikeDay.toISOString().slice(0, 13) + ':00:00.000Z', 50000));
  // Then 3 more normal days
  for (let i = 8; i < 11; i++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    queue.push(q(day.toISOString().slice(0, 13) + ':00:00.000Z', 1050));
  }

  const lastDay = new Date(start);
  lastDay.setUTCDate(lastDay.getUTCDate() + 10);
  const r = buildAnomalies(queue, {
    lookbackDays: 4,
    baselineDays: 7,
    threshold: 2.0,
    asOf: lastDay.toISOString(),
  });
  // Spike should be flagged, but recentHigh should be false (last day was normal)
  assert.ok(r.flagged.length >= 1);
  assert.equal(r.recentHigh, false);
});

test('buildAnomalies: deterministic across calls with same asOf', () => {
  const queue = [
    q('2026-04-20T10:00:00.000Z', 1000),
    q('2026-04-21T10:00:00.000Z', 2000),
    q('2026-04-22T10:00:00.000Z', 1500),
  ];
  const a = buildAnomalies(queue, { asOf: '2026-04-23T00:00:00.000Z' });
  const b = buildAnomalies(queue, { asOf: '2026-04-23T00:00:00.000Z' });
  assert.deepEqual(a, b);
});

test('buildAnomalies: defaults are 30/7/2.0', () => {
  const r = buildAnomalies([], { asOf: '2026-04-24T00:00:00.000Z' });
  assert.equal(r.lookbackDays, 30);
  assert.equal(r.baselineDays, 7);
  assert.equal(r.threshold, 2.0);
});
