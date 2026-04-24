import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeatmap, type HeatmapOptions } from '../src/heatmap.js';
import type { QueueLine } from '../src/types.js';

/**
 * Test helpers — minimal QueueLine builders. We only set fields the
 * heatmap actually reads (hour_start + the four token fields), so
 * mistakes in unrelated fields don't false-positive these tests.
 */
function q(
  hour_start: string,
  tokens: Partial<{
    total: number;
    input: number;
    cached: number;
    output: number;
    reasoning: number;
  }> = {},
): QueueLine {
  return {
    source: 'test',
    model: 'test-model',
    hour_start,
    device_id: 'dev',
    input_tokens: tokens.input ?? 0,
    cached_input_tokens: tokens.cached ?? 0,
    output_tokens: tokens.output ?? 0,
    reasoning_output_tokens: tokens.reasoning ?? 0,
    total_tokens: tokens.total ?? 0,
  };
}

const baseOpts: HeatmapOptions = {
  lookbackDays: 30,
  asOf: '2026-04-24T12:00:00.000Z',
};

describe('buildHeatmap — shape', () => {
  it('produces a 7×24 zero matrix on empty queue', () => {
    const r = buildHeatmap([], baseOpts);
    assert.equal(r.cells.length, 7);
    for (const row of r.cells) assert.equal(row.length, 24);
    assert.equal(r.grandTotal, 0);
    assert.equal(r.events, 0);
    assert.equal(r.peakCell, null);
    assert.equal(r.peakDow, null);
    assert.equal(r.peakHour, null);
    assert.equal(r.diurnalConcentration, null);
    assert.equal(r.weeklyConcentration, null);
  });

  it('rowTotals + colTotals + grandTotal stay consistent', () => {
    // 2026-04-22 = Wed (ISO dow 3); 14:00 UTC.
    // 2026-04-23 = Thu (ISO dow 4); 09:00 UTC.
    const queue = [
      q('2026-04-22T14:00:00.000Z', { total: 100 }),
      q('2026-04-23T09:00:00.000Z', { total: 250 }),
    ];
    const r = buildHeatmap(queue, baseOpts);
    const rowSum = r.rowTotals.reduce((a, b) => a + b, 0);
    const colSum = r.colTotals.reduce((a, b) => a + b, 0);
    assert.equal(rowSum, 350);
    assert.equal(colSum, 350);
    assert.equal(r.grandTotal, 350);
    assert.equal(r.events, 2);
    // Wed bucket = ISO dow 3 → cells[2][14]
    assert.equal(r.cells[2]![14], 100);
    // Thu bucket = ISO dow 4 → cells[3][9]
    assert.equal(r.cells[3]![9], 250);
  });
});

describe('buildHeatmap — peak detection', () => {
  it('identifies the single hottest cell', () => {
    const queue = [
      q('2026-04-20T03:00:00.000Z', { total: 10 }),  // Mon 03
      q('2026-04-21T17:00:00.000Z', { total: 999 }), // Tue 17 — peak
      q('2026-04-22T08:00:00.000Z', { total: 50 }),  // Wed 08
    ];
    const r = buildHeatmap(queue, baseOpts);
    assert.deepEqual(r.peakCell, { dow: 2, hour: 17, tokens: 999 });
    assert.equal(r.peakDow, 2);
    assert.equal(r.peakHour, 17);
  });

  it('breaks ties by lower-index for determinism', () => {
    // Two cells with identical token counts; first-seen wins.
    const queue = [
      q('2026-04-20T05:00:00.000Z', { total: 100 }), // Mon 05
      q('2026-04-22T05:00:00.000Z', { total: 100 }), // Wed 05
    ];
    const r = buildHeatmap(queue, baseOpts);
    // Inner loop iterates rows then cols; Mon (dow 1) comes first.
    assert.deepEqual(r.peakCell, { dow: 1, hour: 5, tokens: 100 });
  });
});

describe('buildHeatmap — metric switch', () => {
  const queue = [
    q('2026-04-20T10:00:00.000Z', {
      total: 1000,
      input: 700,
      cached: 200,
      output: 100,
      reasoning: 50,
    }),
  ];

  it('default metric is total_tokens', () => {
    const r = buildHeatmap(queue, baseOpts);
    assert.equal(r.grandTotal, 1000);
    assert.equal(r.metric, 'total');
  });

  it('input metric uses input_tokens only', () => {
    const r = buildHeatmap(queue, { ...baseOpts, metric: 'input' });
    assert.equal(r.grandTotal, 700);
  });

  it('cached metric uses cached_input_tokens', () => {
    const r = buildHeatmap(queue, { ...baseOpts, metric: 'cached' });
    assert.equal(r.grandTotal, 200);
  });

  it('output metric sums output + reasoning_output', () => {
    const r = buildHeatmap(queue, { ...baseOpts, metric: 'output' });
    assert.equal(r.grandTotal, 150);
  });
});

describe('buildHeatmap — window filtering', () => {
  it('excludes events outside the lookback window', () => {
    // asOf is 2026-04-24; lookbackDays=7 → window [2026-04-18 .. 2026-04-24].
    const queue = [
      q('2026-04-10T12:00:00.000Z', { total: 999 }), // outside
      q('2026-04-18T12:00:00.000Z', { total: 100 }), // window edge
      q('2026-04-24T12:00:00.000Z', { total: 200 }), // inclusive end
    ];
    const r = buildHeatmap(queue, { ...baseOpts, lookbackDays: 7 });
    assert.equal(r.grandTotal, 300);
    assert.equal(r.events, 2);
    assert.equal(r.windowStart, '2026-04-18');
    assert.equal(r.windowEnd, '2026-04-24');
  });

  it('throws on lookbackDays < 1', () => {
    assert.throws(() => buildHeatmap([], { ...baseOpts, lookbackDays: 0 }));
  });
});

describe('buildHeatmap — concentration metrics', () => {
  it('uniform activity → near-uniform concentration', () => {
    // 1 token in every cell of every hour, every day. 7 × 24 = 168 cells,
    // 1 token each = grandTotal 168.
    const queue: QueueLine[] = [];
    // Put one event per (dow, hour) inside the window.
    // 2026-04-18..04-24 covers Sat..Fri = full week.
    for (let day = 18; day <= 24; day++) {
      for (let h = 0; h < 24; h++) {
        const iso = `2026-04-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00.000Z`;
        queue.push(q(iso, { total: 1 }));
      }
    }
    const r = buildHeatmap(queue, { ...baseOpts, lookbackDays: 7 });
    assert.equal(r.grandTotal, 168);
    // top-4-hr-share ≈ 4/24 = 0.1667 (uniform colTotals = 7 each).
    assert.ok(
      Math.abs(r.diurnalConcentration! - 4 / 24) < 1e-9,
      `diurnalConcentration ${r.diurnalConcentration} should be ~${4 / 24}`,
    );
    // top-2-day-share = 2/7 = 0.2857.
    assert.ok(
      Math.abs(r.weeklyConcentration! - 2 / 7) < 1e-9,
      `weeklyConcentration ${r.weeklyConcentration} should be ~${2 / 7}`,
    );
  });

  it('all activity in one cell → concentration = 1.0', () => {
    const queue = [q('2026-04-22T03:00:00.000Z', { total: 5000 })];
    const r = buildHeatmap(queue, { ...baseOpts, lookbackDays: 7 });
    assert.equal(r.diurnalConcentration, 1);
    assert.equal(r.weeklyConcentration, 1);
  });

  it('top-4-hr window can wrap midnight (circular)', () => {
    // Place all activity at hours 22, 23, 00, 01 across multiple days.
    // The 4-hour wrap-around window 22→01 should capture all of it.
    const queue = [
      q('2026-04-21T22:00:00.000Z', { total: 100 }),
      q('2026-04-21T23:00:00.000Z', { total: 100 }),
      q('2026-04-22T00:00:00.000Z', { total: 100 }),
      q('2026-04-22T01:00:00.000Z', { total: 100 }),
    ];
    const r = buildHeatmap(queue, { ...baseOpts, lookbackDays: 7 });
    assert.equal(r.diurnalConcentration, 1);
  });
});

describe('buildHeatmap — ISO dow mapping', () => {
  it('Sunday maps to ISO dow 7, Monday to 1', () => {
    // 2026-04-19 is a Sunday (UTC).
    // 2026-04-20 is a Monday (UTC).
    const queue = [
      q('2026-04-19T10:00:00.000Z', { total: 7 }),
      q('2026-04-20T10:00:00.000Z', { total: 1 }),
    ];
    const r = buildHeatmap(queue, baseOpts);
    assert.equal(r.cells[6]![10], 7); // Sun = index 6
    assert.equal(r.cells[0]![10], 1); // Mon = index 0
  });

  it('weekend (Sat+Sun) totals isolate correctly', () => {
    // 2026-04-18 = Sat (ISO 6); 2026-04-19 = Sun (ISO 7).
    const queue = [
      q('2026-04-18T12:00:00.000Z', { total: 50 }),
      q('2026-04-19T15:00:00.000Z', { total: 75 }),
      q('2026-04-20T09:00:00.000Z', { total: 999 }), // Mon weekday
    ];
    const r = buildHeatmap(queue, { ...baseOpts, lookbackDays: 7 });
    const weekendTokens = r.rowTotals[5]! + r.rowTotals[6]!;
    assert.equal(weekendTokens, 125);
    assert.equal(r.rowTotals[0], 999);
  });
});

describe('buildHeatmap — multiple events per cell aggregate', () => {
  it('sums repeated (dow, hour) cells', () => {
    const queue = [
      q('2026-04-20T11:00:00.000Z', { total: 10 }),
      q('2026-04-20T11:00:00.000Z', { total: 20 }),
      q('2026-04-20T11:00:00.000Z', { total: 30 }),
    ];
    const r = buildHeatmap(queue, baseOpts);
    assert.equal(r.cells[0]![11], 60);
    assert.equal(r.events, 3);
  });
});

describe('buildHeatmap — tz=local', () => {
  it('produces a valid 7×24 matrix with consistent totals (tz-agnostic invariant)', () => {
    // We can't pin exact buckets without knowing the host TZ, but
    // the *shape* and *totals* must hold regardless of TZ. Same
    // grand total as utc, same event count, same matrix dims.
    const queue = [
      q('2026-04-22T14:00:00.000Z', { total: 100 }),
      q('2026-04-23T09:00:00.000Z', { total: 250 }),
    ];
    const utc = buildHeatmap(queue, { ...baseOpts, tz: 'utc' });
    const local = buildHeatmap(queue, { ...baseOpts, tz: 'local' });
    assert.equal(local.grandTotal, utc.grandTotal);
    assert.equal(local.events, utc.events);
    assert.equal(local.cells.length, 7);
    for (const row of local.cells) assert.equal(row.length, 24);
    assert.equal(local.tz, 'local');
  });
});
