import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyTokenHjorthComplexity,
  hjorthComplexity,
} from '../src/dailytokenhjorthcomplexity.js';
import type { QueueLine } from '../src/types.js';

const GEN = '2025-01-01T00:00:00.000Z';

function row(day: string, source: string, total_tokens: number): QueueLine {
  return {
    hour_start: `${day}T00:00:00.000Z`,
    source,
    total_tokens,
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    requests: 1,
    bucket: 'b',
    project_ref: null,
    file_offset: 0,
    file_size: 0,
  } as unknown as QueueLine;
}

function buildSeries(values: number[], source = 'src-a'): QueueLine[] {
  // anchor day = 2024-01-01; one row per consecutive UTC day.
  const out: QueueLine[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const ms = Date.parse('2024-01-01T00:00:00.000Z') + i * 86_400_000;
    const day = new Date(ms).toISOString().slice(0, 10);
    if (values[i]! > 0) out.push(row(day, source, values[i]!));
  }
  return out;
}

// ---- hjorthComplexity primitive -------------------------------------

test('hjorthComplexity: rejects non-finite values', () => {
  assert.throws(() => hjorthComplexity([1, 2, NaN, 4, 5]));
  assert.throws(() => hjorthComplexity([Infinity, 1, 2, 3, 4]));
});

test('hjorthComplexity: rejects too-short series (n < 4)', () => {
  assert.throws(() => hjorthComplexity([]));
  assert.throws(() => hjorthComplexity([1, 2]));
  assert.throws(() => hjorthComplexity([1, 2, 3]));
});

test('hjorthComplexity: rejects zero variance (constant series)', () => {
  assert.throws(() => hjorthComplexity([7, 7, 7, 7, 7]));
});

test('hjorthComplexity: rejects zero diff variance (linear ramp)', () => {
  // y = 0,1,2,3,4 -> dv = 1,1,1,1 (constant) -> var(dv) = 0
  assert.throws(() => hjorthComplexity([0, 1, 2, 3, 4]));
});

test('hjorthComplexity: scale-invariant (multiply by k != 0)', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = hjorthComplexity(v).complexity;
  const b = hjorthComplexity(v.map((x) => 17 * x)).complexity;
  assert.ok(Math.abs(a - b) < 1e-12, `expected scale-invariance, got ${a} vs ${b}`);
});

test('hjorthComplexity: shift-invariant (add constant)', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = hjorthComplexity(v).complexity;
  const b = hjorthComplexity(v.map((x) => x + 1000)).complexity;
  assert.ok(Math.abs(a - b) < 1e-10, `expected shift-invariance, got ${a} vs ${b}`);
});

test('hjorthComplexity: sign-flip-invariant', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = hjorthComplexity(v).complexity;
  const b = hjorthComplexity(v.map((x) => -x)).complexity;
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('hjorthComplexity: time-reversal invariant', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = hjorthComplexity(v).complexity;
  const b = hjorthComplexity([...v].reverse()).complexity;
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('hjorthComplexity: pure sinusoid -> complexity ~ 1', () => {
  // Long sine: complexity should approach 1 (bandwidth ~ centroid for
  // a single tone in Hjorth's framework; the analytic limit is exactly 1).
  const N = 4096;
  const v: number[] = [];
  for (let i = 0; i < N; i += 1) v.push(Math.sin((2 * Math.PI * i) / 16));
  const r = hjorthComplexity(v).complexity;
  assert.ok(Math.abs(r - 1) < 0.05, `pure sine complexity should be ~1, got ${r}`);
});

test('hjorthComplexity: white noise -> complexity > 1', () => {
  // Deterministic LCG so the test is reproducible.
  let s = 1234567;
  const N = 4000;
  const v: number[] = [];
  for (let i = 0; i < N; i += 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    v.push(s / 0x7fffffff - 0.5);
  }
  const r = hjorthComplexity(v).complexity;
  assert.ok(r > 1.05, `white-noise complexity should exceed 1, got ${r}`);
});

test('hjorthComplexity: numerical stability on large-magnitude series (1e12)', () => {
  const small = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const large = small.map((x) => x * 1e12);
  const a = hjorthComplexity(small).complexity;
  const b = hjorthComplexity(large).complexity;
  assert.ok(Math.abs(a - b) < 1e-9, `expected stable scale-invariance, got ${a} vs ${b}`);
});

// ---- Orthogonality witness vs axis-79 (mobility) ---------------------

test('hjorthComplexity: orthogonal to mobility (same mobility, split complexity)', async () => {
  const { hjorthMobility } = await import('../src/dailytokenhjorthmobility.js');
  // Series A: pure sinusoid at omega such that mobility ~ 0.4
  // Series B: equal-mobility multi-component (sum of two sinusoids
  // tuned so that their joint mobility lands near 0.4 too)
  const N = 2000;
  const A: number[] = [];
  for (let i = 0; i < N; i += 1) A.push(Math.cos((2 * Math.PI * i) / 32));
  const B: number[] = [];
  for (let i = 0; i < N; i += 1) {
    B.push(
      Math.cos((2 * Math.PI * i) / 8) + Math.cos((2 * Math.PI * i) / 64),
    );
  }
  const mA = hjorthMobility(A).mobility;
  const mB = hjorthMobility(B).mobility;
  const cA = hjorthComplexity(A).complexity;
  const cB = hjorthComplexity(B).complexity;
  // The two complexities differ by a wide margin even when mobilities
  // overlap; this is the orthogonality witness.
  assert.ok(
    Math.abs(cA - cB) > 0.1,
    `complexity should split A vs B, got cA=${cA} cB=${cB} (mA=${mA} mB=${mB})`,
  );
  // Sanity: pure sine A has complexity close to 1.
  assert.ok(Math.abs(cA - 1) < 0.05, `pure-sine A complexity ~ 1, got ${cA}`);
});

// ---- buildDailyTokenHjorthComplexity orchestration -------------------

test('buildDailyTokenHjorthComplexity: empty queue -> zero rows', () => {
  const r = buildDailyTokenHjorthComplexity([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('buildDailyTokenHjorthComplexity: drops sparse / short-tenure sources', () => {
  // Tenure=10 (< default 32) but tokens above default min (1000) so the
  // tenure-floor drop is the one we surface.
  const v = [200, 220, 230, 215, 195, 205, 212, 218, 222, 217];
  const r = buildDailyTokenHjorthComplexity(buildSeries(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenHjorthComplexity: drops zero-variance gap-filled sources', () => {
  // Long flat run that survives min-tokens but has zero variance after
  // gap-fill (same number every day).
  const v: number[] = new Array(40).fill(50);
  const r = buildDailyTokenHjorthComplexity(buildSeries(v), { generatedAt: GEN });
  // totalTokens = 40*50 = 2000 -> survives min-tokens (1000)
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenHjorthComplexity: numeric correctness on hand-built series', () => {
  // Long sinusoidal series (tenure 60, all positive) -> complexity ~ 1
  const N = 60;
  const v: number[] = [];
  for (let i = 0; i < N; i += 1) {
    v.push(1000 + Math.round(500 * Math.sin((2 * Math.PI * i) / 12)));
  }
  const r = buildDailyTokenHjorthComplexity(buildSeries(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row0 = r.sources[0]!;
  assert.equal(row0.nTenureDays, N);
  assert.ok(
    Math.abs(row0.complexity - 1) < 0.15,
    `roughly-sinusoidal token series complexity ~ 1, got ${row0.complexity}`,
  );
});

test('buildDailyTokenHjorthComplexity: --top caps and surfaces droppedTopSources', () => {
  // Build 4 distinct sources each with 40-day tenure; cap top=2.
  const queue: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    const src = `src-${s}`;
    for (let i = 0; i < 40; i += 1) {
      const ms = Date.parse('2024-01-01T00:00:00.000Z') + i * 86_400_000;
      const day = new Date(ms).toISOString().slice(0, 10);
      const v = 100 + Math.round(50 * Math.sin((2 * Math.PI * i) / (4 + s)));
      if (v > 0) queue.push(row(day, src, v));
    }
  }
  const r = buildDailyTokenHjorthComplexity(queue, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenHjorthComplexity: --source filter restricts and surfaces drops', () => {
  const N = 40;
  const va: number[] = [];
  const vb: number[] = [];
  for (let i = 0; i < N; i += 1) {
    va.push(100 + Math.round(40 * Math.sin((2 * Math.PI * i) / 7)));
    vb.push(100 + Math.round(40 * Math.cos((2 * Math.PI * i) / 11)));
  }
  const queue = [...buildSeries(va, 'src-a'), ...buildSeries(vb, 'src-b')];
  const r = buildDailyTokenHjorthComplexity(queue, {
    generatedAt: GEN,
    source: 'src-a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenHjorthComplexity: input validation', () => {
  assert.throws(() => buildDailyTokenHjorthComplexity([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenHjorthComplexity([], { minTenureDays: 4 }));
  assert.throws(() => buildDailyTokenHjorthComplexity([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenHjorthComplexity([], { sort: 'nonsense' as never }),
  );
  assert.throws(() => buildDailyTokenHjorthComplexity([], { since: 'bad-date' }));
});

test('buildDailyTokenHjorthComplexity: --sort source orders alphabetically', () => {
  const N = 40;
  const v: number[] = [];
  for (let i = 0; i < N; i += 1) v.push(100 + Math.round(40 * Math.sin(i / 3)));
  const queue = [
    ...buildSeries(v, 'zeta'),
    ...buildSeries(v, 'alpha'),
    ...buildSeries(v, 'mike'),
  ];
  const r = buildDailyTokenHjorthComplexity(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mike', 'zeta'],
  );
});
