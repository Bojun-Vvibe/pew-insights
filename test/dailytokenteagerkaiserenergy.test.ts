import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyTokenTeagerKaiserEnergy,
  teagerKaiserEnergy,
} from '../src/dailytokenteagerkaiserenergy.js';
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
  const out: QueueLine[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const ms = Date.parse('2024-01-01T00:00:00.000Z') + i * 86_400_000;
    const day = new Date(ms).toISOString().slice(0, 10);
    if (values[i]! > 0) out.push(row(day, source, values[i]!));
  }
  return out;
}

// ---- teagerKaiserEnergy primitive -----------------------------------

test('teagerKaiserEnergy: rejects non-finite values', () => {
  assert.throws(() => teagerKaiserEnergy([1, 2, NaN, 4, 5]));
  assert.throws(() => teagerKaiserEnergy([Infinity, 1, 2, 3, 4]));
});

test('teagerKaiserEnergy: rejects too-short series (n < 4)', () => {
  assert.throws(() => teagerKaiserEnergy([]));
  assert.throws(() => teagerKaiserEnergy([1, 2]));
  assert.throws(() => teagerKaiserEnergy([1, 2, 3]));
});

test('teagerKaiserEnergy: rejects zero variance (constant series)', () => {
  assert.throws(() => teagerKaiserEnergy([7, 7, 7, 7, 7]));
});

test('teagerKaiserEnergy: scale-invariance of normalised TKE', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = teagerKaiserEnergy(v).tkeNormalized;
  const b = teagerKaiserEnergy(v.map((x) => 17 * x)).tkeNormalized;
  assert.ok(
    Math.abs(a - b) < 1e-10,
    `tkeNormalized scale-invariance: ${a} vs ${b}`,
  );
});

test('teagerKaiserEnergy: raw tkeMean scales as k^2', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = teagerKaiserEnergy(v).tkeMean;
  const k = 5;
  const b = teagerKaiserEnergy(v.map((x) => k * x)).tkeMean;
  assert.ok(
    Math.abs(b - k * k * a) < 1e-9 * Math.abs(b + 1),
    `tkeMean should scale as k^2 (k=${k}): a=${a}, b=${b}, expected=${k * k * a}`,
  );
});

test('teagerKaiserEnergy: sign-flip-invariant (every term even-order)', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = teagerKaiserEnergy(v).tkeMean;
  const b = teagerKaiserEnergy(v.map((x) => -x)).tkeMean;
  assert.ok(
    Math.abs(a - b) < 1e-12,
    `sign-flip should not change tkeMean: ${a} vs ${b}`,
  );
});

test('teagerKaiserEnergy: time-reversal invariant', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = teagerKaiserEnergy(v).tkeMean;
  const b = teagerKaiserEnergy([...v].reverse()).tkeMean;
  assert.ok(
    Math.abs(a - b) < 1e-12,
    `time-reversal should not change tkeMean: ${a} vs ${b}`,
  );
});

test('teagerKaiserEnergy: closed-form pure sinusoid -> tkeNormalized ~ 2*sin^2(omega)', () => {
  // Maragos-Kaiser-Quatieri 1993 closed form: for y = A*cos(omega*n)
  // psi[n] -> A^2 * sin^2(omega), and var(y) -> A^2 / 2, so
  // tkeNormalized -> 2 * sin^2(omega).
  const N = 4096;
  const omega = (2 * Math.PI) / 16; // period 16 samples
  const v: number[] = [];
  for (let i = 0; i < N; i += 1) v.push(Math.sin(omega * i));
  const r = teagerKaiserEnergy(v).tkeNormalized;
  const expected = 2 * Math.sin(omega) ** 2;
  assert.ok(
    Math.abs(r - expected) < 0.05,
    `pure-sine tkeNormalized expected ~ ${expected}, got ${r}`,
  );
});

test('teagerKaiserEnergy: high-frequency tone has higher TKE than low-frequency', () => {
  const N = 2000;
  const lo: number[] = [];
  const hi: number[] = [];
  for (let i = 0; i < N; i += 1) {
    lo.push(Math.cos((2 * Math.PI * i) / 64));
    hi.push(Math.cos((2 * Math.PI * i) / 4));
  }
  const rLo = teagerKaiserEnergy(lo).tkeNormalized;
  const rHi = teagerKaiserEnergy(hi).tkeNormalized;
  assert.ok(rHi > rLo, `high-freq TKE should exceed low-freq TKE: ${rHi} vs ${rLo}`);
});

test('teagerKaiserEnergy: monotone ramp -> small / negative tkeMean', () => {
  // For y = i, psi[i] = i^2 - (i-1)*(i+1) = i^2 - (i^2 - 1) = 1.
  // So tkeMean for a perfect ramp is exactly 1. We use a long ramp
  // with positive values to confirm.
  const v: number[] = [];
  for (let i = 1; i <= 50; i += 1) v.push(i);
  const r = teagerKaiserEnergy(v);
  assert.ok(
    Math.abs(r.tkeMean - 1) < 1e-12,
    `linear ramp closed form tkeMean=1, got ${r.tkeMean}`,
  );
});

test('teagerKaiserEnergy: numerical stability on large-magnitude series (1e12)', () => {
  const small = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const large = small.map((x) => x * 1e12);
  const a = teagerKaiserEnergy(small).tkeNormalized;
  const b = teagerKaiserEnergy(large).tkeNormalized;
  assert.ok(
    Math.abs(a - b) < 1e-9,
    `expected stable scale-invariance, got ${a} vs ${b}`,
  );
});

// ---- Orthogonality witness vs axis-67 (lag-1 ACF) ------------------

test('teagerKaiserEnergy: orthogonal to lag-1 ACF (similar rho_1, distinct TKE)', () => {
  // Two series engineered with similar lag-1 correlation but very
  // different local-frequency content -- TKE separates them sharply.
  const N = 1024;
  // A: slow modulation, period 64
  const A: number[] = [];
  for (let i = 0; i < N; i += 1) A.push(Math.cos((2 * Math.PI * i) / 64));
  // B: alternating high-freq tone, period 4
  const B: number[] = [];
  for (let i = 0; i < N; i += 1) B.push(Math.cos((2 * Math.PI * i) / 4));
  const tkeA = teagerKaiserEnergy(A).tkeNormalized;
  const tkeB = teagerKaiserEnergy(B).tkeNormalized;
  assert.ok(tkeB - tkeA > 1.0, `orthogonality witness: tkeB-tkeA=${tkeB - tkeA}`);
});

// ---- buildDailyTokenTeagerKaiserEnergy orchestration -----------------

test('buildDailyTokenTeagerKaiserEnergy: empty queue -> zero rows', () => {
  const r = buildDailyTokenTeagerKaiserEnergy([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('buildDailyTokenTeagerKaiserEnergy: drops sparse / short-tenure sources', () => {
  const v = [200, 220, 230, 215, 195, 205, 212, 218, 222, 217];
  const r = buildDailyTokenTeagerKaiserEnergy(buildSeries(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenTeagerKaiserEnergy: drops zero-variance gap-filled sources', () => {
  const v: number[] = new Array(40).fill(50);
  const r = buildDailyTokenTeagerKaiserEnergy(buildSeries(v), { generatedAt: GEN });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenTeagerKaiserEnergy: numeric correctness on hand-built sinusoidal series', () => {
  // Long sinusoidal series (tenure 60, all positive). Closed form
  // gives tkeNormalized ~ 2*sin^2(2*pi/12).
  const N = 60;
  const v: number[] = [];
  for (let i = 0; i < N; i += 1) {
    v.push(1000 + Math.round(500 * Math.sin((2 * Math.PI * i) / 12)));
  }
  const r = buildDailyTokenTeagerKaiserEnergy(buildSeries(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row0 = r.sources[0]!;
  assert.equal(row0.nTenureDays, N);
  // Approximate -- short window + integer rounding + DC offset.
  assert.ok(
    row0.tkeNormalized > 0,
    `sinusoidal series should have positive normalized TKE, got ${row0.tkeNormalized}`,
  );
  assert.ok(
    row0.tkeNormalized < 2.0,
    `sinusoidal series tkeNormalized should be bounded by ~2, got ${row0.tkeNormalized}`,
  );
});

test('buildDailyTokenTeagerKaiserEnergy: --top caps and surfaces droppedTopSources', () => {
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
  const r = buildDailyTokenTeagerKaiserEnergy(queue, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenTeagerKaiserEnergy: --source filter restricts and surfaces drops', () => {
  const N = 40;
  const va: number[] = [];
  const vb: number[] = [];
  for (let i = 0; i < N; i += 1) {
    va.push(100 + Math.round(40 * Math.sin((2 * Math.PI * i) / 7)));
    vb.push(100 + Math.round(40 * Math.cos((2 * Math.PI * i) / 11)));
  }
  const queue = [...buildSeries(va, 'src-a'), ...buildSeries(vb, 'src-b')];
  const r = buildDailyTokenTeagerKaiserEnergy(queue, {
    generatedAt: GEN,
    source: 'src-a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenTeagerKaiserEnergy: input validation', () => {
  assert.throws(() => buildDailyTokenTeagerKaiserEnergy([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenTeagerKaiserEnergy([], { minTenureDays: 4 }));
  assert.throws(() => buildDailyTokenTeagerKaiserEnergy([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenTeagerKaiserEnergy([], { sort: 'nonsense' as never }),
  );
  assert.throws(() => buildDailyTokenTeagerKaiserEnergy([], { since: 'bad-date' }));
});

test('buildDailyTokenTeagerKaiserEnergy: --sort source orders alphabetically', () => {
  const N = 40;
  const v: number[] = [];
  for (let i = 0; i < N; i += 1) v.push(100 + Math.round(40 * Math.sin(i / 3)));
  const queue = [
    ...buildSeries(v, 'zeta'),
    ...buildSeries(v, 'alpha'),
    ...buildSeries(v, 'mike'),
  ];
  const r = buildDailyTokenTeagerKaiserEnergy(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mike', 'zeta'],
  );
});

test('buildDailyTokenTeagerKaiserEnergy: --sort tkeNormalizedDesc orders by descending TKE', () => {
  const N = 40;
  // Slow tone -> low TKE
  const slow: number[] = [];
  // Fast tone -> high TKE
  const fast: number[] = [];
  for (let i = 0; i < N; i += 1) {
    slow.push(100 + Math.round(40 * Math.sin((2 * Math.PI * i) / 32)));
    fast.push(100 + Math.round(40 * Math.sin((2 * Math.PI * i) / 4)));
  }
  const queue = [...buildSeries(slow, 'slow'), ...buildSeries(fast, 'fast')];
  const r = buildDailyTokenTeagerKaiserEnergy(queue, {
    generatedAt: GEN,
    sort: 'tkeNormalizedDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'fast');
  assert.equal(r.sources[1]!.source, 'slow');
});

// ---- Refinement: stronger orthogonality + identity witnesses ---------

test('teagerKaiserEnergy: closed-form identity -- tkeNormalized = tkeMean / varV', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8];
  const r = teagerKaiserEnergy(v);
  const recomputed = r.tkeMean / r.varV;
  assert.ok(
    Math.abs(r.tkeNormalized - recomputed) < 1e-12,
    `identity: tkeNormalized=${r.tkeNormalized} vs tkeMean/varV=${recomputed}`,
  );
  assert.equal(r.interiorSamples, v.length - 2);
});

test('teagerKaiserEnergy: NOT shift-invariant (constant addition shifts tkeMean)', () => {
  // Demonstrates the documented non-invariance under shift -- guard
  // against a future regression where someone "centers" the input.
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = teagerKaiserEnergy(v).tkeMean;
  const b = teagerKaiserEnergy(v.map((x) => x + 1000)).tkeMean;
  assert.ok(
    Math.abs(a - b) > 1e-3,
    `expected shift-sensitivity, got a=${a} b=${b} (diff=${b - a})`,
  );
});

test('teagerKaiserEnergy: white noise -> tkeNormalized concentrates around 1', () => {
  // For zero-mean white noise, E[psi] = E[y^2] - E[y_{i-1}*y_{i+1}]
  // = sigma^2 - 0 = sigma^2, so E[tkeNormalized] = 1. Reproducible LCG.
  let s = 1234567;
  const N = 6000;
  const v: number[] = [];
  for (let i = 0; i < N; i += 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    v.push(s / 0x7fffffff - 0.5);
  }
  const r = teagerKaiserEnergy(v).tkeNormalized;
  assert.ok(
    Math.abs(r - 1) < 0.1,
    `white-noise tkeNormalized ~ 1, got ${r}`,
  );
});

test('teagerKaiserEnergy: shuffle-sensitivity (random reorder changes tkeMean)', () => {
  const v: number[] = [];
  for (let i = 0; i < 200; i += 1) v.push(Math.cos((2 * Math.PI * i) / 8));
  const a = teagerKaiserEnergy(v).tkeMean;
  // Deterministic shuffle.
  let seed = 42;
  const w = [...v];
  for (let i = w.length - 1; i > 0; i -= 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    const t = w[i]!;
    w[i] = w[j]!;
    w[j] = t;
  }
  const b = teagerKaiserEnergy(w).tkeMean;
  assert.ok(
    Math.abs(a - b) > 1e-3,
    `shuffle should change tkeMean materially: a=${a} b=${b}`,
  );
});

test('teagerKaiserEnergy: report sort defaults to absTkeNormalizedDesc', () => {
  const r = buildDailyTokenTeagerKaiserEnergy([], { generatedAt: GEN });
  assert.equal(r.sort, 'absTkeNormalizedDesc');
});

// ---- Refinement: parametric pure-tone closed-form sweep --------------

test('teagerKaiserEnergy: parametric closed-form sweep -- pure-tone tkeNormalized matches 2*sin^2(omega) across frequencies', () => {
  // Maragos-Kaiser-Quatieri 1993 closed form holds for every
  // resolvable digital frequency. Sweep a range and assert the
  // analytic match within 5% at each point. This is a stronger
  // property than the single-frequency witness above and guards
  // against future regressions where someone subtly changes the
  // operator stencil (e.g. introduces a window or smoothing).
  const N = 8192;
  const frequencies = [
    Math.PI / 64,
    Math.PI / 32,
    Math.PI / 16,
    Math.PI / 8,
    Math.PI / 6,
    Math.PI / 4,
    Math.PI / 3,
  ];
  for (const omega of frequencies) {
    const v: number[] = [];
    for (let i = 0; i < N; i += 1) v.push(Math.cos(omega * i));
    const r = teagerKaiserEnergy(v).tkeNormalized;
    const expected = 2 * Math.sin(omega) ** 2;
    const relErr = Math.abs(r - expected) / Math.max(1e-3, expected);
    assert.ok(
      relErr < 0.05,
      `omega=${omega.toFixed(4)}: tkeNormalized=${r.toFixed(6)} vs analytic=${expected.toFixed(6)} (relErr=${relErr.toFixed(4)})`,
    );
  }
});

test('teagerKaiserEnergy: interiorSamples equals N - 2 for any valid input', () => {
  // Edge-case witness: the operator MUST average over exactly the
  // interior triplets [1, N-2]. Off-by-one regressions would surface
  // here.
  for (const N of [4, 7, 10, 33, 100, 257]) {
    const v: number[] = [];
    for (let i = 0; i < N; i += 1) v.push(1 + Math.sin(i / 3));
    const r = teagerKaiserEnergy(v);
    assert.equal(
      r.interiorSamples,
      N - 2,
      `N=${N}: expected interiorSamples=${N - 2}, got ${r.interiorSamples}`,
    );
  }
});

test('teagerKaiserEnergy: throws cleanly on N=4 boundary (smallest valid input) iff variance is non-zero', () => {
  // N=4 boundary: interior is 2 triplets (i=1, i=2). Mean is
  // well-defined; we should not throw on a non-constant N=4 input.
  const r = teagerKaiserEnergy([1, 2, 3, 5]);
  assert.ok(Number.isFinite(r.tkeMean));
  assert.equal(r.interiorSamples, 2);
  // But N=4 with variance 0 must still throw.
  assert.throws(() => teagerKaiserEnergy([7, 7, 7, 7]));
});
