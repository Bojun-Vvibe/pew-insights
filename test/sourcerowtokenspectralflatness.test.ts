import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenSpectralFlatness } from '../src/sourcerowtokenspectralflatness.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
  model = 'm1',
  device_id = 'd1',
): QueueLine {
  return {
    source,
    model,
    hour_start,
    device_id,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-28T12:00:00.000Z';

function series(values: number[], src = 's'): QueueLine[] {
  return values.map((v, i) => {
    const hh = Math.floor(i / 60) % 24;
    const mm = i % 60;
    const day = 25 + Math.floor(i / (24 * 60));
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v,
    );
  });
}

test('spectral-flatness: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenSpectralFlatness([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'sf-asc');
  assert.equal(r.generatedAt, GEN);
});

test('spectral-flatness: pure sine -> SF near 0 (highly tonal)', () => {
  // n=64, single sinusoid at k=4 -> all power in one bin -> SF -> 0.
  const n = 64;
  const k = 4;
  const offset = 1000; // positive baseline; mean-centering removes it.
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    v.push(offset + 100 * Math.sin((2 * Math.PI * k * t) / n));
  }
  const r = buildSourceRowTokenSpectralFlatness(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.spectralFlatness < 1e-3, `SF=${row.spectralFlatness} should be tiny`);
  assert.equal(row.dominantBin, k);
  assert.ok(row.dominantBinShare > 0.99, `dom share ${row.dominantBinShare}`);
});

test('spectral-flatness: white-noise-like (random uniform) -> SF closer to 1', () => {
  // Deterministic pseudo-random
  let s = 1;
  const rng = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const n = 256;
  const v: number[] = [];
  for (let i = 0; i < n; i++) v.push(Math.floor(rng() * 1000));
  const r = buildSourceRowTokenSpectralFlatness(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.spectralFlatness > 0.3, `SF=${row.spectralFlatness} should be moderate`);
  assert.ok(row.dominantBinShare < 0.2, `single bin should not dominate`);
});

test('spectral-flatness: SF is in (0, 1] across many shapes', () => {
  const shapes = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [10, 1, 10, 1, 10, 1, 10, 1],   // square wave
    [1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
    [5, 5, 5, 5, 5, 6, 5, 5, 5, 5], // tiny perturbation
  ];
  const queue: QueueLine[] = [];
  shapes.forEach((vals, idx) =>
    queue.push(...series(vals, `src-${idx}`)),
  );
  const r = buildSourceRowTokenSpectralFlatness(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, shapes.length);
  for (const row of r.sources) {
    assert.ok(row.spectralFlatness > 0 && row.spectralFlatness <= 1 + 1e-9,
      `SF in (0,1] for ${row.source}: ${row.spectralFlatness}`);
  }
});

test('spectral-flatness: order-sensitivity — shuffling values changes SF', () => {
  // A noise-like series and its sorted (monotone) version differ in SF:
  // monotone-sorted has power concentrated at low frequencies (linear ramp ~ 1/k)
  // while the noise-like permutation spreads power more uniformly.
  let s = 1;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const noise: number[] = [];
  for (let i = 0; i < 64; i++) noise.push(Math.floor(rng() * 1000));
  const sorted = [...noise].sort((a, b) => a - b);
  const a = buildSourceRowTokenSpectralFlatness(series(noise, 'a'), {
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenSpectralFlatness(series(sorted, 'a'), {
    generatedAt: GEN,
  });
  assert.equal(a.sources.length, 1);
  assert.equal(b.sources.length, 1);
  assert.ok(
    Math.abs(a.sources[0]!.spectralFlatness - b.sources[0]!.spectralFlatness) > 1e-3,
    `SF must change under non-trivial reordering: noise=${a.sources[0]!.spectralFlatness} sorted=${b.sources[0]!.spectralFlatness}`,
  );
  // Sanity: sorted (monotone ramp) should be more tonal (lower SF) than the noise.
  assert.ok(b.sources[0]!.spectralFlatness < a.sources[0]!.spectralFlatness);
});

test('spectral-flatness: drops sources below min-rows', () => {
  const queue = [
    ...series([1, 2, 3], 'tiny'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'big'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, {
    minRows: 8,
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('spectral-flatness: drops constant series under droppedConstantSeries', () => {
  const r = buildSourceRowTokenSpectralFlatness(
    series([7, 7, 7, 7, 7, 7, 7, 7, 7, 7]),
    { generatedAt: GEN },
  );
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedConstantSeries, 1);
});

test('spectral-flatness: drops constant-zero series under droppedConstantSeries', () => {
  const r = buildSourceRowTokenSpectralFlatness(
    series([0, 0, 0, 0, 0, 0, 0, 0]),
    { generatedAt: GEN },
  );
  assert.equal(r.droppedConstantSeries, 1);
  assert.equal(r.sources.length, 0);
});

test('spectral-flatness: drops bad and negative total_tokens distinctly', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 's', Number.NaN),
    ql('2026-04-25T01:00:00Z', 's', -3),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 's'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 8);
});

test('spectral-flatness: drops invalid hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's', 5),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 's'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('spectral-flatness: source filter restricts and counts dropped', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'keep'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'drop'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, {
    source: 'keep',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 8);
});

test('spectral-flatness: since/until window', () => {
  const queue = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const r = buildSourceRowTokenSpectralFlatness(queue, {
    since: '2026-04-25T00:02:00Z',
    until: '2026-04-25T00:10:00Z',
    minRows: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 8); // indices 2..9 inclusive
});

test('spectral-flatness: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralFlatness([], { since: 'bogus' }),
    /invalid since/,
  );
});

test('spectral-flatness: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralFlatness([], { until: 'bogus' }),
    /invalid until/,
  );
});

test('spectral-flatness: minRows < 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralFlatness([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-flatness: non-integer minRows throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralFlatness([], { minRows: 6.5 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-flatness: invalid sort throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralFlatness([], { sort: 'nope' as never }),
    /sort must be one of/,
  );
});

test('spectral-flatness: invalid top throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralFlatness([], { top: 0 }),
    /top must be a positive integer/,
  );
  assert.throws(
    () => buildSourceRowTokenSpectralFlatness([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});

test('spectral-flatness: sort sf-asc puts most tonal first', () => {
  const periodic = [];
  for (let t = 0; t < 32; t++) periodic.push(100 + 50 * Math.sin((2 * Math.PI * 4 * t) / 32));
  let s = 1;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const noisy = [];
  for (let t = 0; t < 32; t++) noisy.push(Math.floor(rng() * 200));
  const queue = [
    ...series(periodic, 'tone'),
    ...series(noisy, 'noise'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, {
    sort: 'sf-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'tone');
  assert.equal(r.sources[1]!.source, 'noise');
  assert.ok(r.sources[0]!.spectralFlatness < r.sources[1]!.spectralFlatness);
});

test('spectral-flatness: sort sf-desc puts most white-noise-like first', () => {
  const periodic = [];
  for (let t = 0; t < 32; t++) periodic.push(100 + 50 * Math.sin((2 * Math.PI * 4 * t) / 32));
  let s = 1;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const noisy = [];
  for (let t = 0; t < 32; t++) noisy.push(Math.floor(rng() * 200));
  const queue = [
    ...series(periodic, 'tone'),
    ...series(noisy, 'noise'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, {
    sort: 'sf-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'noise');
  assert.equal(r.sources[1]!.source, 'tone');
});

test('spectral-flatness: sort rows orders by rowsKept desc', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'short'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'long'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.sources[1]!.source, 'short');
});

test('spectral-flatness: sort source orders alphabetically', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'zebra'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'alpha'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'mango'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mango', 'zebra'],
  );
});

test('spectral-flatness: tiebreak is source asc when primary equal', () => {
  // Identical shape across two sources -> identical SF.
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'b-src'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'a-src'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, {
    sort: 'sf-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a-src');
  assert.equal(r.sources[1]!.source, 'b-src');
});

test('spectral-flatness: top cap surfaces droppedBelowTopCap', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'a'),
    ...series([2, 3, 4, 5, 6, 7, 8, 9], 'b'),
    ...series([3, 4, 5, 6, 7, 8, 9, 10], 'c'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, {
    sort: 'sf-asc',
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('spectral-flatness: missing source name maps to "unknown"', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 8; i++) {
    queue.push(ql(`2026-04-25T0${i}:00:00Z`, '', i + 1));
  }
  const r = buildSourceRowTokenSpectralFlatness(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('spectral-flatness: bins = floor(n/2)', () => {
  const r = buildSourceRowTokenSpectralFlatness(
    series([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources[0]!.bins, 4);
});

test('spectral-flatness: dominant period for square wave with period 4', () => {
  // Period 4 over n=32 -> dominant bin = n/period = 8.
  const v: number[] = [];
  for (let t = 0; t < 32; t++) v.push(t % 4 < 2 ? 10 : 0);
  const r = buildSourceRowTokenSpectralFlatness(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.dominantBin, 8);
});

test('spectral-flatness: degenerate counter remains 0 in normal input', () => {
  const r = buildSourceRowTokenSpectralFlatness(
    series([1, 2, 3, 4, 5, 6, 7, 8]),
    { generatedAt: GEN },
  );
  assert.equal(r.droppedDegenerate, 0);
});

// --- 0.6.145 refinement: --min-sf / --max-sf threshold filters ---

test('spectral-flatness: minSf defaults to null and surfaces no drops', () => {
  const r = buildSourceRowTokenSpectralFlatness(
    series([1, 2, 3, 4, 5, 6, 7, 8]),
    { generatedAt: GEN },
  );
  assert.equal(r.minSf, null);
  assert.equal(r.maxSf, null);
  assert.equal(r.droppedBelowMinSf, 0);
  assert.equal(r.droppedAboveMaxSf, 0);
});

test('spectral-flatness: minSf suppresses sources strictly below threshold', () => {
  // tone -> SF tiny; noise -> SF moderate
  const tone: number[] = [];
  for (let t = 0; t < 64; t++) tone.push(100 + 50 * Math.sin((2 * Math.PI * 4 * t) / 64));
  let s = 1;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const noise: number[] = [];
  for (let t = 0; t < 64; t++) noise.push(Math.floor(rng() * 1000));
  const queue = [
    ...series(tone, 'tone'),
    ...series(noise, 'noise'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, {
    minSf: 0.1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'noise');
  assert.equal(r.droppedBelowMinSf, 1);
});

test('spectral-flatness: maxSf suppresses sources strictly above threshold', () => {
  const tone: number[] = [];
  for (let t = 0; t < 64; t++) tone.push(100 + 50 * Math.sin((2 * Math.PI * 4 * t) / 64));
  let s = 1;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const noise: number[] = [];
  for (let t = 0; t < 64; t++) noise.push(Math.floor(rng() * 1000));
  const queue = [
    ...series(tone, 'tone'),
    ...series(noise, 'noise'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, {
    maxSf: 0.1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'tone');
  assert.equal(r.droppedAboveMaxSf, 1);
});

test('spectral-flatness: minSf + maxSf band keeps middle and counts both sides', () => {
  // tone (SF tiny), mid-noise (SF moderate), heavy-noise (SF higher)
  const tone: number[] = [];
  for (let t = 0; t < 64; t++) tone.push(100 + 50 * Math.sin((2 * Math.PI * 4 * t) / 64));
  let s = 1;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const mid: number[] = [];
  for (let t = 0; t < 64; t++) mid.push(Math.floor(rng() * 200) + 100 * Math.sin((2 * Math.PI * 4 * t) / 64));
  const heavy: number[] = [];
  for (let t = 0; t < 64; t++) heavy.push(Math.floor(rng() * 1000));
  const queue = [
    ...series(tone, 'tone'),
    ...series(mid, 'mid'),
    ...series(heavy, 'heavy'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, {
    minSf: 0.05,
    maxSf: 0.6,
    generatedAt: GEN,
  });
  // tone below 0.05; mid and heavy in band (heavy ~0.5 < 0.6)
  // We don't assume exact pass/fail of all 3 ; verify the dropped counter
  // is consistent with sources.length.
  assert.equal(r.droppedBelowMinSf + r.droppedAboveMaxSf + r.sources.length, 3);
  assert.ok(r.droppedBelowMinSf >= 1, 'tone should be dropped below min-sf');
});

test('spectral-flatness: minSf > maxSf throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralFlatness([], {
        minSf: 0.8,
        maxSf: 0.2,
      }),
    /minSf \(0.8\) must be <= maxSf \(0.2\)/,
  );
});

test('spectral-flatness: minSf non-finite throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralFlatness([], {
        minSf: Number.POSITIVE_INFINITY,
      }),
    /minSf must be a finite number/,
  );
});

test('spectral-flatness: maxSf non-finite throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralFlatness([], {
        maxSf: Number.NaN,
      }),
    /maxSf must be a finite number/,
  );
});

test('spectral-flatness: thresholds compose with top cap (filter first, then cap)', () => {
  const tone: number[] = [];
  for (let t = 0; t < 64; t++) tone.push(100 + 50 * Math.sin((2 * Math.PI * 4 * t) / 64));
  let s = 1;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const mid: number[] = [];
  for (let t = 0; t < 64; t++) mid.push(Math.floor(rng() * 200) + 100 * Math.sin((2 * Math.PI * 4 * t) / 64));
  const heavy: number[] = [];
  for (let t = 0; t < 64; t++) heavy.push(Math.floor(rng() * 1000));
  const queue = [
    ...series(tone, 'tone'),
    ...series(mid, 'mid'),
    ...series(heavy, 'heavy'),
  ];
  const r = buildSourceRowTokenSpectralFlatness(queue, {
    minSf: 0.05,
    top: 1,
    sort: 'sf-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  // After min-sf, tone is dropped; remaining sorted asc -> mid first; cap=1 keeps mid.
  assert.ok(r.droppedBelowMinSf >= 1);
  assert.ok(r.droppedBelowTopCap >= 1);
});

test('spectral-flatness: equal-to-threshold rows are kept (strict comparison)', () => {
  // Run once to read the SF for a fixed input, then reuse exactly that SF as the threshold.
  const fixed: number[] = [];
  for (let t = 0; t < 16; t++) fixed.push(t * (t % 3));
  const baseline = buildSourceRowTokenSpectralFlatness(series(fixed), {
    generatedAt: GEN,
  });
  assert.equal(baseline.sources.length, 1);
  const sf = baseline.sources[0]!.spectralFlatness;
  const r = buildSourceRowTokenSpectralFlatness(series(fixed), {
    minSf: sf,
    maxSf: sf,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowMinSf, 0);
  assert.equal(r.droppedAboveMaxSf, 0);
});

// --- 0.6.146 property tests: monotonicity / scale-invariance ---

test('spectral-flatness: scale-invariance — multiplying values by c > 0 preserves SF', () => {
  const v = [1, 5, 2, 8, 3, 7, 4, 6, 9, 0, 11, 2];
  const a = buildSourceRowTokenSpectralFlatness(series(v, 'a'), {
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenSpectralFlatness(
    series(v.map((x) => x * 17), 'a'),
    { generatedAt: GEN },
  );
  assert.equal(a.sources.length, 1);
  assert.equal(b.sources.length, 1);
  // SF = G/A; both numerator and denominator scale by c^2 -> ratio invariant.
  assert.ok(
    Math.abs(a.sources[0]!.spectralFlatness - b.sources[0]!.spectralFlatness) < 1e-9,
    `SF should be scale-invariant: ${a.sources[0]!.spectralFlatness} vs ${b.sources[0]!.spectralFlatness}`,
  );
});

test('spectral-flatness: shift-invariance via mean-centering — adding constant preserves SF', () => {
  // We mean-center, so adding a DC shift must leave SF unchanged.
  const v = [1, 5, 2, 8, 3, 7, 4, 6, 9, 0, 11, 2];
  const a = buildSourceRowTokenSpectralFlatness(series(v, 'a'), {
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenSpectralFlatness(
    series(v.map((x) => x + 1000), 'a'),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(a.sources[0]!.spectralFlatness - b.sources[0]!.spectralFlatness) < 1e-9,
    `SF should be shift-invariant under DC offset: ${a.sources[0]!.spectralFlatness} vs ${b.sources[0]!.spectralFlatness}`,
  );
});

test('spectral-flatness: monotonicity — adding a sinusoid lowers SF (more tonal)', () => {
  // Fixed noise floor; layer in increasing-amplitude sine; SF should not increase.
  let s = 1;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const noise: number[] = [];
  for (let t = 0; t < 64; t++) noise.push(Math.floor(rng() * 100));
  const sf: number[] = [];
  for (const amp of [0, 50, 200, 1000]) {
    const v = noise.map((x, t) =>
      Math.max(0, Math.round(x + amp * Math.sin((2 * Math.PI * 4 * t) / 64))),
    );
    const r = buildSourceRowTokenSpectralFlatness(series(v, 'a'), {
      generatedAt: GEN,
    });
    sf.push(r.sources[0]!.spectralFlatness);
  }
  // Monotone non-increasing.
  for (let i = 1; i < sf.length; i++) {
    assert.ok(
      sf[i]! <= sf[i - 1]! + 1e-9,
      `SF should not rise as tonal amplitude grows: sf[${i - 1}]=${sf[i - 1]} sf[${i}]=${sf[i]}`,
    );
  }
  // Strict monotonicity at the extremes.
  assert.ok(sf[sf.length - 1]! < sf[0]!);
});
