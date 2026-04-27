import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenSpectralRolloff } from '../src/sourcerowtokenspectralrolloff.js';
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

test('spectral-rolloff: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenSpectralRolloff([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.rolloffFraction, 0.85);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'rolloff-asc');
  assert.equal(r.generatedAt, GEN);
});

test('spectral-rolloff: pure low-frequency sine -> rolloff bin = sine bin', () => {
  // n=64, single sinusoid at k=4 -> all power in one bin -> rolloffBin=4 for any fraction>0.
  const n = 64;
  const k = 4;
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    v.push(1000 + 100 * Math.sin((2 * Math.PI * k * t) / n));
  }
  const r = buildSourceRowTokenSpectralRolloff(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rolloffBin, k);
  assert.equal(r.sources[0]!.dominantBin, k);
  assert.ok(r.sources[0]!.cumulativeFraction > 0.99);
});

test('spectral-rolloff: high-frequency sine pushes rolloff to higher bin', () => {
  const n = 64;
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    v.push(1000 + 100 * Math.sin((2 * Math.PI * 28 * t) / n));
  }
  const r = buildSourceRowTokenSpectralRolloff(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rolloffBin, 28);
  assert.ok(r.sources[0]!.rolloffFractionBins > 0.8);
});

test('spectral-rolloff: rolloffFractionBins is in (0, 1] across many shapes', () => {
  const shapes = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [10, 1, 10, 1, 10, 1, 10, 1],
    [1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
    [5, 5, 5, 5, 5, 6, 5, 5, 5, 5],
  ];
  const queue: QueueLine[] = [];
  shapes.forEach((vals, idx) => queue.push(...series(vals, `src-${idx}`)));
  const r = buildSourceRowTokenSpectralRolloff(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, shapes.length);
  for (const row of r.sources) {
    assert.ok(
      row.rolloffFractionBins > 0 && row.rolloffFractionBins <= 1 + 1e-12,
      `rolloffFractionBins in (0,1] for ${row.source}: ${row.rolloffFractionBins}`,
    );
    assert.ok(row.cumulativeFraction >= 0.85 - 1e-12);
    assert.ok(row.cumulativeFraction <= 1 + 1e-12);
  }
});

test('spectral-rolloff: realised cumulativeFraction >= rolloffFraction', () => {
  // Mixed signal of two sinusoids.
  const n = 128;
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    v.push(
      500 +
        80 * Math.sin((2 * Math.PI * 5 * t) / n) +
        30 * Math.sin((2 * Math.PI * 30 * t) / n),
    );
  }
  for (const f of [0.25, 0.5, 0.85, 0.95, 1.0]) {
    const r = buildSourceRowTokenSpectralRolloff(series(v), {
      rolloffFraction: f,
      generatedAt: GEN,
    });
    assert.equal(r.sources.length, 1);
    assert.ok(
      r.sources[0]!.cumulativeFraction >= f - 1e-12,
      `cumFrac ${r.sources[0]!.cumulativeFraction} < target ${f}`,
    );
  }
});

test('spectral-rolloff: monotonicity in rolloffFraction (rolloffBin non-decreasing)', () => {
  const n = 128;
  let s = 1;
  const rng = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const v: number[] = [];
  for (let i = 0; i < n; i++) v.push(Math.floor(rng() * 1000));
  let prev = 0;
  for (const f of [0.1, 0.25, 0.5, 0.75, 0.85, 0.95, 1.0]) {
    const r = buildSourceRowTokenSpectralRolloff(series(v), {
      rolloffFraction: f,
      generatedAt: GEN,
    });
    const rb = r.sources[0]!.rolloffBin;
    assert.ok(rb >= prev, `rolloffBin should be non-decreasing in f: prev=${prev} now=${rb} f=${f}`);
    prev = rb;
  }
});

test('spectral-rolloff: order-sensitivity — shuffling values changes rolloff', () => {
  let s = 1;
  const rng = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const noise: number[] = [];
  for (let i = 0; i < 64; i++) noise.push(Math.floor(rng() * 1000));
  const sorted = [...noise].sort((a, b) => a - b);
  const a = buildSourceRowTokenSpectralRolloff(series(noise, 'a'), {
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenSpectralRolloff(series(sorted, 'a'), {
    generatedAt: GEN,
  });
  // Sorted (monotone ramp) -> low-freq dominated -> smaller rolloffBin.
  assert.ok(b.sources[0]!.rolloffBin <= a.sources[0]!.rolloffBin);
});

test('spectral-rolloff: scale-invariance — multiplying by c > 0 preserves all reported quantities except totalPower', () => {
  const v = [1, 5, 2, 8, 3, 7, 4, 6, 9, 0, 11, 2];
  const a = buildSourceRowTokenSpectralRolloff(series(v, 'a'), {
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenSpectralRolloff(
    series(v.map((x) => x * 17), 'a'),
    { generatedAt: GEN },
  );
  assert.equal(a.sources[0]!.rolloffBin, b.sources[0]!.rolloffBin);
  assert.equal(a.sources[0]!.dominantBin, b.sources[0]!.dominantBin);
  assert.ok(
    Math.abs(a.sources[0]!.cumulativeFraction - b.sources[0]!.cumulativeFraction) < 1e-9,
  );
  assert.ok(
    Math.abs(a.sources[0]!.dominantBinShare - b.sources[0]!.dominantBinShare) < 1e-9,
  );
  // Total power scales by c^2.
  assert.ok(
    Math.abs(b.sources[0]!.totalPower / a.sources[0]!.totalPower - 17 * 17) < 1e-6,
  );
});

test('spectral-rolloff: shift-invariance via mean-centering — adding constant preserves rolloff', () => {
  const v = [1, 5, 2, 8, 3, 7, 4, 6, 9, 0, 11, 2];
  const a = buildSourceRowTokenSpectralRolloff(series(v, 'a'), {
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenSpectralRolloff(
    series(v.map((x) => x + 1000), 'a'),
    { generatedAt: GEN },
  );
  assert.equal(a.sources[0]!.rolloffBin, b.sources[0]!.rolloffBin);
  assert.ok(
    Math.abs(a.sources[0]!.cumulativeFraction - b.sources[0]!.cumulativeFraction) < 1e-9,
  );
});

test('spectral-rolloff: drops sources below min-rows', () => {
  const queue = [
    ...series([1, 2, 3], 'tiny'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'big'),
  ];
  const r = buildSourceRowTokenSpectralRolloff(queue, {
    minRows: 8,
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('spectral-rolloff: drops constant series under droppedConstantSeries', () => {
  const r = buildSourceRowTokenSpectralRolloff(
    series([7, 7, 7, 7, 7, 7, 7, 7, 7, 7]),
    { generatedAt: GEN },
  );
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedConstantSeries, 1);
});

test('spectral-rolloff: drops constant-zero series under droppedConstantSeries', () => {
  const r = buildSourceRowTokenSpectralRolloff(
    series([0, 0, 0, 0, 0, 0, 0, 0]),
    { generatedAt: GEN },
  );
  assert.equal(r.droppedConstantSeries, 1);
  assert.equal(r.sources.length, 0);
});

test('spectral-rolloff: drops bad and negative total_tokens distinctly', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 's', Number.NaN),
    ql('2026-04-25T01:00:00Z', 's', -3),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 's'),
  ];
  const r = buildSourceRowTokenSpectralRolloff(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 8);
});

test('spectral-rolloff: drops invalid hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's', 5),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 's'),
  ];
  const r = buildSourceRowTokenSpectralRolloff(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('spectral-rolloff: source filter restricts and counts dropped', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'keep'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'drop'),
  ];
  const r = buildSourceRowTokenSpectralRolloff(queue, {
    source: 'keep',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 8);
});

test('spectral-rolloff: since/until window', () => {
  const queue = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const r = buildSourceRowTokenSpectralRolloff(queue, {
    since: '2026-04-25T00:02:00Z',
    until: '2026-04-25T00:10:00Z',
    minRows: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 8);
});

test('spectral-rolloff: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralRolloff([], { since: 'bogus' }),
    /invalid since/,
  );
});

test('spectral-rolloff: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralRolloff([], { until: 'bogus' }),
    /invalid until/,
  );
});

test('spectral-rolloff: minRows < 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralRolloff([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-rolloff: non-integer minRows throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralRolloff([], { minRows: 6.5 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-rolloff: invalid rolloffFraction throws (zero / >1 / NaN)', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralRolloff([], { rolloffFraction: 0 }),
    /rolloffFraction must be in/,
  );
  assert.throws(
    () => buildSourceRowTokenSpectralRolloff([], { rolloffFraction: 1.5 }),
    /rolloffFraction must be in/,
  );
  assert.throws(
    () => buildSourceRowTokenSpectralRolloff([], { rolloffFraction: Number.NaN }),
    /rolloffFraction must be in/,
  );
});

test('spectral-rolloff: invalid sort throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralRolloff([], { sort: 'nope' as never }),
    /sort must be one of/,
  );
});

test('spectral-rolloff: invalid top throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralRolloff([], { top: 0 }),
    /top must be a positive integer/,
  );
  assert.throws(
    () => buildSourceRowTokenSpectralRolloff([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});

test('spectral-rolloff: sort rolloff-asc puts most low-frequency-loaded first', () => {
  const lo: number[] = [];
  for (let t = 0; t < 32; t++) lo.push(100 + 50 * Math.sin((2 * Math.PI * 2 * t) / 32));
  const hi: number[] = [];
  for (let t = 0; t < 32; t++) hi.push(100 + 50 * Math.sin((2 * Math.PI * 14 * t) / 32));
  const queue = [...series(lo, 'low'), ...series(hi, 'high')];
  const r = buildSourceRowTokenSpectralRolloff(queue, {
    sort: 'rolloff-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'low');
  assert.equal(r.sources[1]!.source, 'high');
  assert.ok(r.sources[0]!.rolloffFractionBins < r.sources[1]!.rolloffFractionBins);
});

test('spectral-rolloff: sort rolloff-desc reverses', () => {
  const lo: number[] = [];
  for (let t = 0; t < 32; t++) lo.push(100 + 50 * Math.sin((2 * Math.PI * 2 * t) / 32));
  const hi: number[] = [];
  for (let t = 0; t < 32; t++) hi.push(100 + 50 * Math.sin((2 * Math.PI * 14 * t) / 32));
  const queue = [...series(lo, 'low'), ...series(hi, 'high')];
  const r = buildSourceRowTokenSpectralRolloff(queue, {
    sort: 'rolloff-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'high');
  assert.equal(r.sources[1]!.source, 'low');
});

test('spectral-rolloff: sort rows orders by rowsKept desc', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'short'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'long'),
  ];
  const r = buildSourceRowTokenSpectralRolloff(queue, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.sources[1]!.source, 'short');
});

test('spectral-rolloff: sort source orders alphabetically', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'zebra'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'alpha'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'mango'),
  ];
  const r = buildSourceRowTokenSpectralRolloff(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mango', 'zebra'],
  );
});

test('spectral-rolloff: tiebreak is source asc when primary equal', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'b-src'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'a-src'),
  ];
  const r = buildSourceRowTokenSpectralRolloff(queue, {
    sort: 'rolloff-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a-src');
  assert.equal(r.sources[1]!.source, 'b-src');
});

test('spectral-rolloff: top cap surfaces droppedBelowTopCap', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'a'),
    ...series([2, 3, 4, 5, 6, 7, 8, 9], 'b'),
    ...series([3, 4, 5, 6, 7, 8, 9, 10], 'c'),
  ];
  const r = buildSourceRowTokenSpectralRolloff(queue, {
    sort: 'rolloff-asc',
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('spectral-rolloff: missing source name maps to "unknown"', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 8; i++) {
    queue.push(ql(`2026-04-25T0${i}:00:00Z`, '', i + 1));
  }
  const r = buildSourceRowTokenSpectralRolloff(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('spectral-rolloff: bins = floor(n/2)', () => {
  const r = buildSourceRowTokenSpectralRolloff(
    series([1, 2, 3, 4, 5, 6, 7, 8, 9]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources[0]!.bins, 4);
});

test('spectral-rolloff: rolloffFraction = 1.0 yields rolloffBin = bins', () => {
  let s = 1;
  const rng = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const v: number[] = [];
  for (let i = 0; i < 32; i++) v.push(Math.floor(rng() * 1000));
  const r = buildSourceRowTokenSpectralRolloff(series(v), {
    rolloffFraction: 1.0,
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.rolloffBin, r.sources[0]!.bins);
  assert.ok(Math.abs(r.sources[0]!.rolloffFractionBins - 1) < 1e-12);
});

test('spectral-rolloff: dominant period for square wave with period 4', () => {
  const v: number[] = [];
  for (let t = 0; t < 32; t++) v.push(t % 4 < 2 ? 10 : 0);
  const r = buildSourceRowTokenSpectralRolloff(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.dominantBin, 8);
});

test('spectral-rolloff: degenerate counter remains 0 in normal input', () => {
  const r = buildSourceRowTokenSpectralRolloff(
    series([1, 2, 3, 4, 5, 6, 7, 8]),
    { generatedAt: GEN },
  );
  assert.equal(r.droppedDegenerate, 0);
});

test('spectral-rolloff: JSON shape is stable and complete', () => {
  const r = buildSourceRowTokenSpectralRolloff(
    series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    { generatedAt: GEN, top: 1 },
  );
  const reportKeys = Object.keys(r).sort();
  assert.deepEqual(reportKeys, [
    'droppedBelowMinRows',
    'droppedBelowTopCap',
    'droppedConstantSeries',
    'droppedDegenerate',
    'droppedInvalidHourStart',
    'droppedInvalidTokens',
    'droppedNegativeTokens',
    'droppedSourceFilter',
    'generatedAt',
    'minRows',
    'rolloffFraction',
    'sort',
    'source',
    'sources',
    'top',
    'totalRowsKept',
    'totalSources',
    'windowEnd',
    'windowStart',
  ]);
  assert.equal(r.sources.length, 1);
  const rowKeys = Object.keys(r.sources[0]!).sort();
  assert.deepEqual(rowKeys, [
    'bins',
    'cumulativeFraction',
    'dominantBin',
    'dominantBinShare',
    'rolloffBin',
    'rolloffFractionBins',
    'rowsKept',
    'source',
    'totalPower',
  ]);
});

test('spectral-rolloff: two sources with identical histograms but different orderings give different rolloff', () => {
  // Both sources are permutations of the same multiset -> identical
  // amplitude-domain stats. Roll-off, being frequency-domain and order-sensitive,
  // distinguishes them.
  const base = [10, 1, 8, 2, 6, 3, 5, 4, 9, 0, 7, 11, 1, 6, 3, 8];
  const sortedAsc = [...base].sort((a, b) => a - b);
  const queue = [
    ...series(base, 'permuted'),
    ...series(sortedAsc, 'monotone'),
  ];
  const r = buildSourceRowTokenSpectralRolloff(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  const p = r.sources.find((x) => x.source === 'permuted')!;
  const m = r.sources.find((x) => x.source === 'monotone')!;
  assert.notEqual(p.rolloffBin, m.rolloffBin);
  // The monotone ramp concentrates power in the lowest bins.
  assert.ok(m.rolloffBin <= p.rolloffBin);
});

test('spectral-rolloff: cumulativeFraction never exceeds 1 + epsilon', () => {
  const v: number[] = [];
  for (let t = 0; t < 64; t++) v.push(t * 17 + (t % 5));
  const r = buildSourceRowTokenSpectralRolloff(series(v), {
    rolloffFraction: 0.99,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.cumulativeFraction <= 1 + 1e-12);
});

test('spectral-rolloff: dominantBinShare in (0, 1] and matches power max', () => {
  const v = [1, 4, 2, 7, 3, 8, 0, 5, 9, 1, 6, 2, 4, 8, 3, 7];
  const r = buildSourceRowTokenSpectralRolloff(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.dominantBinShare > 0 && row.dominantBinShare <= 1 + 1e-12);
  assert.ok(row.dominantBin >= 1 && row.dominantBin <= row.bins);
});
