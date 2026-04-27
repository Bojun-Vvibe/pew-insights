import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenHurstRs } from '../src/sourcerowtokenhurstrs.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

function series(values: number[], src = 's'): QueueLine[] {
  return values.map((v, i) => {
    const minutesIntoMonth = i;
    const day = 1 + Math.floor(minutesIntoMonth / (24 * 60));
    const hh = Math.floor(minutesIntoMonth / 60) % 24;
    const mm = minutesIntoMonth % 60;
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v,
    );
  });
}

// Deterministic LCG so we don't depend on Math.random for white-noise series.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('hurst-rs: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenHurstRs([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 32);
  assert.equal(r.minWindow, 8);
  assert.equal(r.maxScales, 12);
  assert.equal(r.minScales, 3);
  assert.equal(r.sort, 'abs-hurst-deviation-desc');
  assert.equal(r.generatedAt, GEN);
});

test('hurst-rs: drops source below min-rows', () => {
  // 20 rows < default minRows=32.
  const queue = series(Array.from({ length: 20 }, (_, i) => i + 1), 'short');
  const r = buildSourceRowTokenHurstRs(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('hurst-rs: white noise gives H ~ 0.5 (within 0.2)', () => {
  const rng = lcg(424242);
  const n = 512;
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    // Uniform(0, 100) noise -> i.i.d. -> classical R/S H ~ 0.5
    // (with small-sample positive bias; we accept |H - 0.5| < 0.2).
    values.push(Math.floor(rng() * 100) + 1);
  }
  const queue = series(values, 'wn');
  const r = buildSourceRowTokenHurstRs(queue, {
    generatedAt: GEN,
    minRows: 32,
    minWindow: 8,
    maxScales: 12,
    minScales: 3,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'wn');
  assert.equal(row.rowsKept, n);
  assert.ok(
    Math.abs(row.hurst - 0.5) < 0.2,
    `expected H ~ 0.5 for white noise, got ${row.hurst}`,
  );
  assert.ok(row.scalesUsed >= 3);
  assert.ok(row.r2 >= 0 && row.r2 <= 1);
});

test('hurst-rs: monotone-ramp series drives H well above 0.5', () => {
  // Strict monotone increase: classical R/S failure mode -> H near 1.
  const n = 256;
  const values = Array.from({ length: n }, (_, i) => i + 1);
  const queue = series(values, 'ramp');
  const r = buildSourceRowTokenHurstRs(queue, {
    generatedAt: GEN,
    minRows: 32,
    minWindow: 8,
    maxScales: 10,
    minScales: 3,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  // Trended series: classical R/S well above 0.5, typically near 1.
  assert.ok(
    row.hurst > 0.7,
    `expected H >> 0.5 for monotone ramp, got ${row.hurst}`,
  );
  // Log-log fit on a smooth ramp should be very tight.
  assert.ok(row.r2 > 0.9, `expected high R^2, got ${row.r2}`);
});

test('hurst-rs: anti-persistent two-state alternation drives H below 0.5', () => {
  // Strict alternation 1,100,1,100,... is the canonical anti-persistent
  // toy series; classical R/S yields H well below 0.5.
  const n = 256;
  const values = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 1 : 100));
  const queue = series(values, 'alt');
  const r = buildSourceRowTokenHurstRs(queue, {
    generatedAt: GEN,
    minRows: 32,
    minWindow: 8,
    maxScales: 10,
    minScales: 3,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(
    row.hurst < 0.4,
    `expected H < 0.4 for strict alternation, got ${row.hurst}`,
  );
});

test('hurst-rs: all-equal series surfaces under droppedAllDegenerate', () => {
  const n = 128;
  const values = Array.from({ length: n }, () => 42);
  const queue = series(values, 'flat');
  const r = buildSourceRowTokenHurstRs(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAllDegenerate, 1);
});

test('hurst-rs: input validation rejects bad opts', () => {
  assert.throws(() => buildSourceRowTokenHurstRs([], { minRows: 8 }));
  assert.throws(() => buildSourceRowTokenHurstRs([], { minRows: 1.5 as number }));
  assert.throws(() => buildSourceRowTokenHurstRs([], { minWindow: 2 }));
  assert.throws(() => buildSourceRowTokenHurstRs([], { maxScales: 2 }));
  assert.throws(() => buildSourceRowTokenHurstRs([], { minScales: 2 }));
  assert.throws(
    () => buildSourceRowTokenHurstRs([], { minScales: 5, maxScales: 4 }),
  );
  assert.throws(() => buildSourceRowTokenHurstRs([], { top: 0 }));
  assert.throws(() =>
    buildSourceRowTokenHurstRs([], {
      sort: 'bogus' as unknown as 'hurst-asc',
    }),
  );
  assert.throws(() => buildSourceRowTokenHurstRs([], { since: 'not-a-date' }));
});

test('hurst-rs: time-order matters (sequence sort by hour_start asc)', () => {
  // Build a ramp but feed rows in shuffled insertion order; the builder
  // must sort by hour_start before computing R/S.
  const n = 128;
  const values = Array.from({ length: n }, (_, i) => i + 1);
  const queue = series(values, 'ord');
  // Shuffle insertion order.
  const rng = lcg(7);
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [queue[i], queue[j]] = [queue[j]!, queue[i]!];
  }
  const r = buildSourceRowTokenHurstRs(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  // Sorted-by-hour reconstruction == strict monotone ramp -> H > 0.7.
  assert.ok(r.sources[0]!.hurst > 0.7);
});

test('hurst-rs: top + sort caps sources after filters', () => {
  const n = 128;
  const rng = lcg(9);
  const noiseA = Array.from({ length: n }, () => Math.floor(rng() * 100) + 1);
  const noiseB = Array.from({ length: n }, () => Math.floor(rng() * 100) + 1);
  const ramp = Array.from({ length: n }, (_, i) => i + 1);
  const alt = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 1 : 100));
  const queue: QueueLine[] = [
    ...series(noiseA, 'a-noise'),
    ...series(noiseB, 'b-noise'),
    ...series(ramp, 'c-ramp'),
    ...series(alt, 'd-alt'),
  ];
  const r = buildSourceRowTokenHurstRs(queue, {
    generatedAt: GEN,
    sort: 'abs-hurst-deviation-desc',
    top: 2,
  });
  assert.equal(r.totalSources, 4);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
  // The two extreme sources (ramp and alt) should win abs-hurst-deviation.
  const surfaced = r.sources.map((s) => s.source).sort();
  assert.deepEqual(surfaced, ['c-ramp', 'd-alt']);
});

test('hurst-rs --detrend: monotone-ramp H collapses toward 0.5 with detrending', () => {
  // Without detrend, classical R/S yields H near 1 on a strict ramp.
  // With detrend, the per-chunk linear fit captures the ramp exactly
  // and the residuals are essentially numerical noise -> H drops
  // dramatically and r2 of the log-log fit collapses.
  const n = 256;
  const values = Array.from({ length: n }, (_, i) => i + 1);
  const queue = series(values, 'ramp');
  const off = buildSourceRowTokenHurstRs(queue, {
    generatedAt: GEN,
    detrend: false,
  });
  const on = buildSourceRowTokenHurstRs(queue, {
    generatedAt: GEN,
    detrend: true,
  });
  assert.equal(off.detrend, false);
  assert.equal(on.detrend, true);
  assert.equal(off.sources.length, 1);
  // The detrended residuals of an exact linear ramp are zero, so every
  // chunk degenerates and the source surfaces under droppedAllDegenerate.
  // This is the correct, honest behaviour: the ramp is *exactly* the
  // OLS fit, so there is no residual memory to measure.
  assert.equal(on.sources.length, 0);
  assert.equal(on.droppedAllDegenerate, 1);
  assert.ok(off.sources[0]!.hurst > 0.7);
});

test('hurst-rs --detrend: white noise + linear drift -> H drops toward 0.5', () => {
  // Construct: linear drift + i.i.d. noise. Without detrend H is
  // inflated above 0.5; with detrend the per-chunk OLS removes the
  // drift and we read the underlying noise H ~ 0.5.
  const rng = lcg(1234);
  const n = 512;
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    const drift = i * 0.5; // monotone linear trend
    const noise = Math.floor(rng() * 100) + 1;
    values.push(Math.round(drift + noise));
  }
  const queue = series(values, 'drift');
  const off = buildSourceRowTokenHurstRs(queue, {
    generatedAt: GEN,
    detrend: false,
  });
  const on = buildSourceRowTokenHurstRs(queue, {
    generatedAt: GEN,
    detrend: true,
  });
  assert.equal(off.sources.length, 1);
  assert.equal(on.sources.length, 1);
  const hOff = off.sources[0]!.hurst;
  const hOn = on.sources[0]!.hurst;
  // Detrending must move H meaningfully closer to 0.5.
  assert.ok(
    Math.abs(hOn - 0.5) < Math.abs(hOff - 0.5),
    `expected detrend to bring H closer to 0.5; off=${hOff} on=${hOn}`,
  );
  // And the detrended H should land in a plausible noise band.
  assert.ok(
    Math.abs(hOn - 0.5) < 0.25,
    `expected detrended H near 0.5, got ${hOn}`,
  );
});

test('hurst-rs --detrend: report carries detrend flag', () => {
  const r1 = buildSourceRowTokenHurstRs([], { generatedAt: GEN });
  const r2 = buildSourceRowTokenHurstRs([], {
    generatedAt: GEN,
    detrend: true,
  });
  assert.equal(r1.detrend, false);
  assert.equal(r2.detrend, true);
});
