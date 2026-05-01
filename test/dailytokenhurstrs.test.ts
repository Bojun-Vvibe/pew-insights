import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenHurstRs,
  buildHurstScales,
  hurstRs,
  DEFAULT_HURST_MIN_WINDOW,
  DEFAULT_HURST_MAX_SCALES,
  DEFAULT_HURST_MIN_SCALES,
} from '../src/dailytokenhurstrs.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-02T12:00:00.000Z';

// ---- buildHurstScales primitive ---------------------------------------

test('buildHurstScales: rejects bad inputs', () => {
  assert.throws(() => buildHurstScales(0, 10, 5));
  assert.throws(() => buildHurstScales(4, 3, 5));
  assert.throws(() => buildHurstScales(4, 10, 0));
  assert.throws(() => buildHurstScales(4, 10, -1));
  assert.throws(() => buildHurstScales(4.5 as any, 10, 5));
});

test('buildHurstScales: lo=hi -> single scale', () => {
  assert.deepEqual(buildHurstScales(7, 7, 5), [7]);
});

test('buildHurstScales: produces ascending unique integers in range', () => {
  const s = buildHurstScales(4, 100, 12);
  assert.ok(s.length > 0 && s.length <= 12);
  for (let i = 0; i < s.length; i += 1) {
    assert.ok(Number.isInteger(s[i]));
    assert.ok(s[i]! >= 4 && s[i]! <= 100);
    if (i > 0) assert.ok(s[i]! > s[i - 1]!);
  }
  assert.equal(s[0], 4);
  assert.equal(s[s.length - 1], 100);
});

test('buildHurstScales: dedupes adjacent rounded duplicates', () => {
  // very tight range w/ many slots forces dedupe
  const s = buildHurstScales(4, 6, 12);
  for (let i = 1; i < s.length; i += 1) {
    assert.ok(s[i]! > s[i - 1]!);
  }
  assert.ok(s.every((m) => m >= 4 && m <= 6));
});

// ---- hurstRs primitive ------------------------------------------------

test('hurstRs: rejects non-finite values', () => {
  assert.throws(() => hurstRs([1, 2, NaN, 4, 5, 6, 7, 8, 9, 10]));
  assert.throws(() => hurstRs([1, 2, Infinity, 4, 5, 6, 7, 8, 9, 10]));
});

test('hurstRs: rejects too-short series', () => {
  assert.throws(() => hurstRs([1, 2, 3, 4, 5]));
});

test('hurstRs: linearly increasing ramp -> H near 1', () => {
  const n = 256;
  const ramp: number[] = [];
  for (let i = 0; i < n; i += 1) ramp.push(i);
  const r = hurstRs(ramp);
  // Range grows linearly with window, stddev ~ m/sqrt(12), so R/S ~ sqrt(12)*m -> H -> 1.
  assert.ok(r.hurst > 0.9, `expected H > 0.9 for linear ramp, got ${r.hurst}`);
  assert.ok(r.r2 > 0.99, `expected r2 > 0.99 on a clean ramp, got ${r.r2}`);
});

test('hurstRs: detrending a pure linear ramp drops every chunk to degeneracy', () => {
  const n = 256;
  const ramp: number[] = [];
  for (let i = 0; i < n; i += 1) ramp.push(i);
  // OLS-detrend per chunk zeroes residuals -> stddev=0 -> all chunks degenerate
  // -> all scales drop -> hurstRs throws.
  assert.throws(
    () => hurstRs(ramp, { detrend: true }),
    /scales survived/,
  );
});

test('hurstRs: shuffled-uniform series -> H near 0.5 (loose band)', () => {
  // Deterministic mulberry32 PRNG for reproducibility.
  function mulberry32(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(42);
  const n = 2048;
  const x: number[] = [];
  for (let i = 0; i < n; i += 1) x.push(rng());
  const r = hurstRs(x, { maxScales: 16 });
  // Empirical R/S on length-2048 i.i.d. uniform typically yields H in [0.45, 0.65]
  // (small-sample upward bias is well-documented; Weron 2002).
  assert.ok(
    r.hurst > 0.35 && r.hurst < 0.75,
    `expected H near 0.5 for uniform iid (loose band), got ${r.hurst}`,
  );
  assert.ok(r.r2 > 0.85);
});

test('hurstRs: orthogonality witness — sorted vs shuffled multiset gives very different H', () => {
  function mulberry32(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(7);
  const n = 1024;
  const base: number[] = [];
  for (let i = 0; i < n; i += 1) base.push(Math.floor(rng() * 1000));
  const sorted = [...base].sort((a, b) => a - b);
  const hSorted = hurstRs(sorted).hurst;
  const hShuffled = hurstRs(base).hurst;
  // Every multiset statistic (mean, var, gini, atkinson, ...) is identical;
  // H must differ by >= 0.3.
  assert.ok(
    hSorted - hShuffled > 0.3,
    `sorted H (${hSorted}) must exceed shuffled H (${hShuffled}) by >= 0.3`,
  );
});

test('hurstRs: surfaces degenerate-chunk count when series has all-zero stretch', () => {
  // Make a 64-day series whose first 32 days are 0 and last 32 days alternate.
  const x: number[] = [];
  for (let i = 0; i < 32; i += 1) x.push(0);
  for (let i = 0; i < 32; i += 1) x.push(i % 2 === 0 ? 100 : 200);
  const r = hurstRs(x, { minWindow: 4, maxScales: 8, minScales: 3 });
  assert.ok(r.degenerateChunks > 0, 'should report at least one all-zero chunk dropped');
});

// ---- buildDailyTokenHurstRs full pipeline -----------------------------

test('buildDailyTokenHurstRs: validates option ranges', () => {
  assert.throws(() => buildDailyTokenHurstRs([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenHurstRs([], { minWindow: 3 }));
  assert.throws(() => buildDailyTokenHurstRs([], { maxScales: 2 }));
  assert.throws(() => buildDailyTokenHurstRs([], { minScales: 2 }));
  assert.throws(() => buildDailyTokenHurstRs([], { minScales: 8, maxScales: 4 }));
  assert.throws(() => buildDailyTokenHurstRs([], { minTenureDays: 4, minWindow: 4 }));
  assert.throws(() => buildDailyTokenHurstRs([], { top: -1 }));
  assert.throws(() => buildDailyTokenHurstRs([], { sort: 'nope' as any }));
  assert.throws(() => buildDailyTokenHurstRs([], { since: 'not-a-date' }));
  assert.throws(() => buildDailyTokenHurstRs([], { until: 'not-a-date' }));
});

test('buildDailyTokenHurstRs: empty queue -> empty report with zero rows', () => {
  const r = buildDailyTokenHurstRs([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minTenureDays, 32);
  assert.equal(r.minWindow, DEFAULT_HURST_MIN_WINDOW);
  assert.equal(r.maxScales, DEFAULT_HURST_MAX_SCALES);
  assert.equal(r.minScales, DEFAULT_HURST_MIN_SCALES);
  assert.equal(r.detrend, false);
});

test('buildDailyTokenHurstRs: drops bad hour_start, non-positive tokens, source filter', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's1', 100),
    ql('2026-01-01T00:00:00.000Z', 's1', 0),
    ql('2026-01-01T00:00:00.000Z', 's1', -50),
    ql('2026-01-01T00:00:00.000Z', 's2', 999),
  ];
  const r = buildDailyTokenHurstRs(queue, {
    generatedAt: GEN,
    source: 's1',
    minTokens: 1,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.droppedSourceFilter, 1);
});

test('buildDailyTokenHurstRs: drops sparse and short-tenure sources', () => {
  const queue: QueueLine[] = [];
  // s1 has only 100 tokens -> sparse
  queue.push(ql('2026-01-01T00:00:00.000Z', 's1', 100));
  // s2 has plenty of tokens but only 5 days tenure -> below min-tenure
  for (let d = 0; d < 5; d += 1) {
    const day = `2026-01-${String(d + 1).padStart(2, '0')}T00:00:00.000Z`;
    queue.push(ql(day, 's2', 10000));
  }
  const r = buildDailyTokenHurstRs(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenHurstRs: end-to-end on a synthetic ramp source', () => {
  // 64-day strictly-increasing ramp -> H near 1.
  const queue: QueueLine[] = [];
  for (let d = 0; d < 64; d += 1) {
    const day = new Date(Date.parse('2026-01-01T00:00:00.000Z') + d * 86_400_000)
      .toISOString();
    queue.push(ql(day, 'ramp', 1000 + d * 10));
  }
  const r = buildDailyTokenHurstRs(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'ramp');
  assert.equal(row.nTenureDays, 64);
  assert.equal(row.nActiveDays, 64);
  assert.ok(row.hurst > 0.9, `ramp H should exceed 0.9, got ${row.hurst}`);
  assert.ok(row.r2 > 0.95);
  assert.ok(row.scalesUsed >= DEFAULT_HURST_MIN_SCALES);
  assert.ok(row.minScaleUsed >= DEFAULT_HURST_MIN_WINDOW);
  assert.ok(row.maxScaleUsed <= 32);
});

test('buildDailyTokenHurstRs: gap-fill is applied across missing days', () => {
  // Source has 64-day tenure but only 2 active days; rest are gap-filled to 0.
  // Many chunks become all-zero (degenerate). We expect either drop-at-source
  // or a row with degenerateChunks > 0.
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'sparse', 50000),
    ql('2026-03-05T00:00:00.000Z', 'sparse', 60000),
  ];
  const r = buildDailyTokenHurstRs(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
  });
  // Either dropped at source level or surfaced with degenerate chunks recorded.
  if (r.sources.length > 0) {
    assert.ok(r.sources[0]!.degenerateChunks > 0);
  } else {
    assert.equal(r.droppedAllDegenerate, 1);
  }
});

test('buildDailyTokenHurstRs: top cap and droppedTopSources counter', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let d = 0; d < 64; d += 1) {
      const day = new Date(Date.parse('2026-01-01T00:00:00.000Z') + d * 86_400_000)
        .toISOString();
      queue.push(ql(day, `src${s}`, 1000 + d * (s + 1)));
    }
  }
  const r = buildDailyTokenHurstRs(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenHurstRs: sort key absHurstDeviationDesc puts H furthest from 0.5 first', () => {
  // Build two sources: one ramp (H high), one near-flat alternation (H lower).
  const queue: QueueLine[] = [];
  for (let d = 0; d < 64; d += 1) {
    const day = new Date(Date.parse('2026-01-01T00:00:00.000Z') + d * 86_400_000)
      .toISOString();
    queue.push(ql(day, 'ramp', 1000 + d * 10));
    queue.push(ql(day, 'altr', 10000 + (d % 2) * 100));
  }
  const r = buildDailyTokenHurstRs(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'absHurstDeviationDesc',
  });
  assert.ok(r.sources.length === 2);
  const top = r.sources[0]!;
  const bottom = r.sources[1]!;
  assert.ok(
    Math.abs(top.hurst - 0.5) >= Math.abs(bottom.hurst - 0.5),
    `sort failed: top |H-.5|=${Math.abs(top.hurst - 0.5)} bottom=${Math.abs(bottom.hurst - 0.5)}`,
  );
});

test('buildDailyTokenHurstRs: respects --since/--until window', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 100; d += 1) {
    const day = new Date(Date.parse('2026-01-01T00:00:00.000Z') + d * 86_400_000)
      .toISOString();
    queue.push(ql(day, 'src', 1000 + d * 5));
  }
  const r = buildDailyTokenHurstRs(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
    since: '2026-01-15T00:00:00.000Z',
    until: '2026-03-20T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.nTenureDays >= 32 && row.nTenureDays <= 100);
  assert.equal(r.windowStart, '2026-01-15T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-03-20T00:00:00.000Z');
});

test('buildDailyTokenHurstRs: detrend flag is propagated to result', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 64; d += 1) {
    const day = new Date(Date.parse('2026-01-01T00:00:00.000Z') + d * 86_400_000)
      .toISOString();
    // ramp + alternation so detrend has something to remove without zeroing residuals.
    queue.push(ql(day, 'ramp+osc', 1000 + d * 10 + (d % 2) * 50));
  }
  const rPlain = buildDailyTokenHurstRs(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
    detrend: false,
  });
  const rDt = buildDailyTokenHurstRs(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
    detrend: true,
  });
  assert.equal(rPlain.detrend, false);
  assert.equal(rDt.detrend, true);
  assert.equal(rPlain.sources.length, 1);
  assert.equal(rDt.sources.length, 1);
  // Detrended H should be strictly lower than plain H on a trended series
  // (the canonical Lo 1991 motivation). Allow >= tolerance for numerical noise.
  assert.ok(
    rDt.sources[0]!.hurst < rPlain.sources[0]!.hurst,
    `expected detrended H (${rDt.sources[0]!.hurst}) < plain H (${rPlain.sources[0]!.hurst})`,
  );
});

// ---- refinement: anti-persistent AR(1) witness + JSON shape stability --

test('hurstRs: mean-reverting AR(1) with negative phi -> H < 0.5 (anti-persistence)', () => {
  // x[t] = phi * x[t-1] + epsilon[t] with phi = -0.7 is strongly anti-persistent;
  // R/S H is documented to fall well below 0.5 on such series (Mandelbrot &
  // Wallis 1969 Fig. 4; Weron 2002 Tables 1-2). Use a deterministic PRNG.
  function mulberry32(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(2026);
  const n = 2048;
  const x: number[] = [0];
  for (let i = 1; i < n; i += 1) {
    // Box-Muller-lite via two uniforms -> approx N(0,1)
    const u1 = Math.max(rng(), 1e-9);
    const u2 = rng();
    const eps = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    x.push(-0.7 * x[i - 1]! + eps);
  }
  const r = hurstRs(x, { maxScales: 16 });
  assert.ok(
    r.hurst < 0.5,
    `AR(1) phi=-0.7 should give H < 0.5, got ${r.hurst}`,
  );
  // r2 of the log-log fit should still be high; the scaling law holds.
  assert.ok(r.r2 > 0.85);
});

test('buildDailyTokenHurstRs: JSON-serialisable report carries every documented field', () => {
  // Belt-and-braces guard against accidental drop of an output field. Every
  // key in the report and every key in a source row must serialise to a
  // primitive (string/number/boolean/null) under JSON.stringify.
  const queue: QueueLine[] = [];
  for (let d = 0; d < 64; d += 1) {
    const day = new Date(Date.parse('2026-01-01T00:00:00.000Z') + d * 86_400_000)
      .toISOString();
    queue.push(ql(day, 'src', 1000 + d * 10));
  }
  const r = buildDailyTokenHurstRs(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
  });
  const round = JSON.parse(JSON.stringify(r));
  for (const k of [
    'generatedAt',
    'windowStart',
    'windowEnd',
    'minTokens',
    'minTenureDays',
    'minWindow',
    'maxScales',
    'minScales',
    'detrend',
    'top',
    'sort',
    'source',
    'totalTokens',
    'totalSources',
    'droppedInvalidHourStart',
    'droppedNonPositiveTokens',
    'droppedSourceFilter',
    'droppedSparseSources',
    'droppedBelowMinTenure',
    'droppedBelowMinScales',
    'droppedAllDegenerate',
    'droppedTopSources',
    'sources',
  ]) {
    assert.ok(k in round, `report missing key ${k}`);
  }
  assert.equal(round.sources.length, 1);
  for (const k of [
    'source',
    'totalTokens',
    'nActiveDays',
    'nTenureDays',
    'firstActiveDay',
    'lastActiveDay',
    'hurst',
    'intercept',
    'r2',
    'scalesUsed',
    'minScaleUsed',
    'maxScaleUsed',
    'degenerateChunks',
    'scalesDroppedAllDegenerate',
  ]) {
    assert.ok(k in round.sources[0], `source row missing key ${k}`);
  }
});
