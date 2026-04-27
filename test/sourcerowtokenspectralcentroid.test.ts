import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenSpectralCentroid } from '../src/sourcerowtokenspectralcentroid.js';
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

test('spectral-centroid: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenSpectralCentroid([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'centroid-asc');
  assert.equal(r.generatedAt, GEN);
});

test('spectral-centroid: pure low-frequency sine -> centroid at sine bin', () => {
  const n = 64;
  const k = 4;
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    v.push(1000 + 100 * Math.sin((2 * Math.PI * k * t) / n));
  }
  const r = buildSourceRowTokenSpectralCentroid(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.ok(Math.abs(r.sources[0]!.centroidBin - k) < 0.5);
  assert.equal(r.sources[0]!.dominantBin, k);
});

test('spectral-centroid: pure high-frequency sine -> high centroid', () => {
  const n = 64;
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    v.push(1000 + 100 * Math.sin((2 * Math.PI * 28 * t) / n));
  }
  const r = buildSourceRowTokenSpectralCentroid(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.ok(Math.abs(r.sources[0]!.centroidBin - 28) < 0.5);
  assert.ok(r.sources[0]!.centroidFractionBins > 0.8);
});

test('spectral-centroid: centroidFractionBins is in (0, 1] across many shapes', () => {
  const shapes = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [10, 1, 10, 1, 10, 1, 10, 1],
    [1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
    [5, 5, 5, 5, 5, 6, 5, 5, 5, 5],
  ];
  const queue: QueueLine[] = [];
  shapes.forEach((vals, idx) => queue.push(...series(vals, `src-${idx}`)));
  const r = buildSourceRowTokenSpectralCentroid(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, shapes.length);
  for (const row of r.sources) {
    assert.ok(
      row.centroidFractionBins > 0 && row.centroidFractionBins <= 1 + 1e-12,
      `centroidFractionBins in (0,1] for ${row.source}: ${row.centroidFractionBins}`,
    );
    assert.ok(row.centroidBin >= 1 - 1e-12 && row.centroidBin <= row.bins + 1e-12);
  }
});

test('spectral-centroid: centroidBin always in [1, bins]', () => {
  const n = 32;
  const v: number[] = [];
  for (let t = 0; t < n; t++) v.push(100 + t * 7 + ((t % 5) - 2) * 17);
  const r = buildSourceRowTokenSpectralCentroid(series(v), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(row.centroidBin >= 1);
  assert.ok(row.centroidBin <= row.bins);
});

test('spectral-centroid: scale invariance — multiplying series by c>0 leaves centroid fixed', () => {
  const v: number[] = [];
  for (let t = 0; t < 64; t++) v.push(500 + 50 * Math.sin((2 * Math.PI * 7 * t) / 64));
  const r1 = buildSourceRowTokenSpectralCentroid(series(v), { generatedAt: GEN });
  const r2 = buildSourceRowTokenSpectralCentroid(
    series(v.map((x) => x * 1000)),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r1.sources[0]!.centroidBin - r2.sources[0]!.centroidBin) < 1e-6,
  );
  assert.ok(
    Math.abs(
      r1.sources[0]!.centroidFractionBins - r2.sources[0]!.centroidFractionBins,
    ) < 1e-9,
  );
});

test('spectral-centroid: shift invariance — adding a constant leaves centroid fixed (DC removed)', () => {
  const v: number[] = [];
  for (let t = 0; t < 64; t++) v.push(50 * Math.sin((2 * Math.PI * 9 * t) / 64));
  const r1 = buildSourceRowTokenSpectralCentroid(series(v.map((x) => x + 1000)), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenSpectralCentroid(series(v.map((x) => x + 50000)), {
    generatedAt: GEN,
  });
  assert.ok(
    Math.abs(r1.sources[0]!.centroidBin - r2.sources[0]!.centroidBin) < 1e-6,
  );
});

test('spectral-centroid: low-freq sine has lower centroid than high-freq sine', () => {
  const n = 64;
  const lo: number[] = [];
  const hi: number[] = [];
  for (let t = 0; t < n; t++) {
    lo.push(1000 + 100 * Math.sin((2 * Math.PI * 3 * t) / n));
    hi.push(1000 + 100 * Math.sin((2 * Math.PI * 25 * t) / n));
  }
  const queue = [...series(lo, 'lo'), ...series(hi, 'hi')];
  const r = buildSourceRowTokenSpectralCentroid(queue, { generatedAt: GEN });
  const loRow = r.sources.find((s) => s.source === 'lo')!;
  const hiRow = r.sources.find((s) => s.source === 'hi')!;
  assert.ok(loRow.centroidBin < hiRow.centroidBin);
  assert.ok(loRow.centroidFractionBins < hiRow.centroidFractionBins);
});

test('spectral-centroid: constant series -> droppedConstantSeries', () => {
  const v = new Array(16).fill(42);
  const r = buildSourceRowTokenSpectralCentroid(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedConstantSeries, 1);
});

test('spectral-centroid: below min-rows -> droppedBelowMinRows', () => {
  const v = [1, 2, 3, 4, 5];
  const r = buildSourceRowTokenSpectralCentroid(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('spectral-centroid: minRows < 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralCentroid([], { minRows: 3 }),
    /minRows/,
  );
});

test('spectral-centroid: minRows non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralCentroid([], { minRows: 7.5 }),
    /minRows/,
  );
});

test('spectral-centroid: top must be positive integer', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralCentroid([], { top: 0 }),
    /top/,
  );
  assert.throws(
    () => buildSourceRowTokenSpectralCentroid([], { top: 1.5 }),
    /top/,
  );
});

test('spectral-centroid: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralCentroid([], {
        // @ts-expect-error invalid
        sort: 'nonsense',
      }),
    /sort/,
  );
});

test('spectral-centroid: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralCentroid([], { since: 'not-a-date' }),
    /since/,
  );
});

test('spectral-centroid: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralCentroid([], { until: 'not-a-date' }),
    /until/,
  );
});

test('spectral-centroid: bad hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's', 100),
    ...series([1, 2, 3, 4, 5, 6, 7, 8]),
  ];
  const r = buildSourceRowTokenSpectralCentroid(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('spectral-centroid: non-finite total_tokens counted', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 's', Number.NaN),
    ...series([1, 2, 3, 4, 5, 6, 7, 8]),
  ];
  const r = buildSourceRowTokenSpectralCentroid(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('spectral-centroid: negative total_tokens counted', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 's', -10),
    ...series([1, 2, 3, 4, 5, 6, 7, 8]),
  ];
  const r = buildSourceRowTokenSpectralCentroid(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('spectral-centroid: source filter', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'a'),
    ...series([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 'b'),
  ];
  const r = buildSourceRowTokenSpectralCentroid(queue, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.source, 'a');
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 10);
});

test('spectral-centroid: empty source name -> "unknown"', () => {
  const queue = series([1, 2, 3, 4, 5, 6, 7, 8], '');
  const r = buildSourceRowTokenSpectralCentroid(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('spectral-centroid: since/until window filters', () => {
  const queue = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenSpectralCentroid(queue, {
    since: '2026-04-25T00:05:00Z',
    until: '2026-04-25T00:09:00Z',
    minRows: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('spectral-centroid: sort centroid-asc puts low brightness first', () => {
  const n = 64;
  const lo: number[] = [];
  const hi: number[] = [];
  for (let t = 0; t < n; t++) {
    lo.push(500 + 50 * Math.sin((2 * Math.PI * 2 * t) / n));
    hi.push(500 + 50 * Math.sin((2 * Math.PI * 28 * t) / n));
  }
  const queue = [...series(lo, 'lo'), ...series(hi, 'hi')];
  const r = buildSourceRowTokenSpectralCentroid(queue, {
    sort: 'centroid-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'lo');
  assert.equal(r.sources[1]!.source, 'hi');
});

test('spectral-centroid: sort centroid-desc puts high brightness first', () => {
  const n = 64;
  const lo: number[] = [];
  const hi: number[] = [];
  for (let t = 0; t < n; t++) {
    lo.push(500 + 50 * Math.sin((2 * Math.PI * 2 * t) / n));
    hi.push(500 + 50 * Math.sin((2 * Math.PI * 28 * t) / n));
  }
  const queue = [...series(lo, 'lo'), ...series(hi, 'hi')];
  const r = buildSourceRowTokenSpectralCentroid(queue, {
    sort: 'centroid-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'hi');
  assert.equal(r.sources[1]!.source, 'lo');
});

test('spectral-centroid: sort rows puts longest series first', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'short'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'long'),
  ];
  const r = buildSourceRowTokenSpectralCentroid(queue, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'long');
});

test('spectral-centroid: sort source is alphabetical', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'zzz'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'aaa'),
  ];
  const r = buildSourceRowTokenSpectralCentroid(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'aaa');
  assert.equal(r.sources[1]!.source, 'zzz');
});

test('spectral-centroid: ties in primary sort broken by source asc', () => {
  // Identical series under two source names -> identical centroid.
  const v = [1, 2, 3, 4, 5, 6, 7, 8];
  const queue = [...series(v, 'beta'), ...series(v, 'alpha')];
  const r = buildSourceRowTokenSpectralCentroid(queue, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'beta');
});

test('spectral-centroid: top cap surfaces droppedBelowTopCap', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 5; s++) {
    const v: number[] = [];
    for (let t = 0; t < 16; t++) {
      v.push(100 + (s + 1) * 10 * Math.sin((2 * Math.PI * (s + 2) * t) / 16));
    }
    queue.push(...series(v, `src-${s}`));
  }
  const r = buildSourceRowTokenSpectralCentroid(queue, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 3);
});

test('spectral-centroid: schema stability — required keys present', () => {
  const r = buildSourceRowTokenSpectralCentroid(
    series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    { generatedAt: GEN },
  );
  for (const key of [
    'generatedAt',
    'windowStart',
    'windowEnd',
    'source',
    'minRows',
    'top',
    'sort',
    'totalSources',
    'totalRowsKept',
    'droppedInvalidHourStart',
    'droppedInvalidTokens',
    'droppedNegativeTokens',
    'droppedSourceFilter',
    'droppedBelowMinRows',
    'droppedConstantSeries',
    'droppedDegenerate',
    'droppedBelowTopCap',
    'sources',
  ]) {
    assert.ok(key in r, `missing ${key}`);
  }
  const row = r.sources[0]!;
  for (const key of [
    'source',
    'rowsKept',
    'bins',
    'totalPower',
    'centroidBin',
    'centroidFractionBins',
    'dominantBin',
    'dominantBinShare',
  ]) {
    assert.ok(key in row, `missing row.${key}`);
  }
});

test('spectral-centroid: deterministic — repeated runs yield identical output', () => {
  const v: number[] = [];
  for (let t = 0; t < 32; t++) v.push(200 + 30 * Math.sin((2 * Math.PI * 5 * t) / 32));
  const r1 = buildSourceRowTokenSpectralCentroid(series(v), { generatedAt: GEN });
  const r2 = buildSourceRowTokenSpectralCentroid(series(v), { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

test('spectral-centroid: dominantBinShare in (0, 1]', () => {
  const v: number[] = [];
  for (let t = 0; t < 64; t++) {
    v.push(100 + 50 * Math.sin((2 * Math.PI * 7 * t) / 64) + Math.cos(t));
  }
  const r = buildSourceRowTokenSpectralCentroid(series(v), { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(row.dominantBinShare > 0);
  assert.ok(row.dominantBinShare <= 1 + 1e-12);
});

test('spectral-centroid: bins = floor(n/2)', () => {
  for (const n of [8, 9, 16, 17, 32]) {
    const v: number[] = [];
    for (let t = 0; t < n; t++) v.push(100 + t);
    const r = buildSourceRowTokenSpectralCentroid(series(v), {
      minRows: 4,
      generatedAt: GEN,
    });
    assert.equal(r.sources[0]!.bins, Math.floor(n / 2));
  }
});

test('spectral-centroid: totalPower > 0 for non-constant series', () => {
  const v: number[] = [];
  for (let t = 0; t < 16; t++) v.push(t === 0 ? 100 : 0);
  const r = buildSourceRowTokenSpectralCentroid(series(v), { generatedAt: GEN });
  assert.ok(r.sources[0]!.totalPower > 0);
});

test('spectral-centroid: white-noise-like series has centroid near middle', () => {
  // Deterministic pseudo-random for reproducibility.
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const n = 256;
  const v: number[] = [];
  for (let t = 0; t < n; t++) v.push(500 + (rand() - 0.5) * 100);
  const r = buildSourceRowTokenSpectralCentroid(series(v), { generatedAt: GEN });
  // White noise: PSD ~ uniform -> centroid ~ (bins+1)/2 -> centroidFractionBins ~ 0.5.
  assert.ok(
    r.sources[0]!.centroidFractionBins > 0.35 &&
      r.sources[0]!.centroidFractionBins < 0.65,
    `centroidFractionBins for white noise: ${r.sources[0]!.centroidFractionBins}`,
  );
});

test('spectral-centroid: window with empty range -> empty', () => {
  const queue = series([1, 2, 3, 4, 5, 6, 7, 8]);
  const r = buildSourceRowTokenSpectralCentroid(queue, {
    since: '2099-01-01T00:00:00Z',
    until: '2099-01-02T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
});

test('spectral-centroid: respect generatedAt override', () => {
  const r = buildSourceRowTokenSpectralCentroid([], {
    generatedAt: '2099-12-31T23:59:59.000Z',
  });
  assert.equal(r.generatedAt, '2099-12-31T23:59:59.000Z');
});

test('spectral-centroid: minRows boundary — exactly minRows passes', () => {
  const v = [1, 2, 3, 4];
  const r = buildSourceRowTokenSpectralCentroid(series(v), {
    minRows: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('spectral-centroid: centroidFractionBins = centroidBin / bins', () => {
  const v: number[] = [];
  for (let t = 0; t < 32; t++) v.push(100 + Math.sin((2 * Math.PI * 5 * t) / 32) * 20);
  const r = buildSourceRowTokenSpectralCentroid(series(v), { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.centroidFractionBins - row.centroidBin / row.bins) < 1e-12);
});

test('spectral-centroid: one source, two clearly different freqs sort correctly', () => {
  const n = 128;
  const sources = ['a', 'b', 'c'];
  const freqs = [3, 20, 40];
  const queue: QueueLine[] = [];
  for (let i = 0; i < 3; i++) {
    const v: number[] = [];
    for (let t = 0; t < n; t++) {
      v.push(500 + 50 * Math.sin((2 * Math.PI * freqs[i]! * t) / n));
    }
    queue.push(...series(v, sources[i]));
  }
  const r = buildSourceRowTokenSpectralCentroid(queue, {
    sort: 'centroid-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
  assert.equal(r.sources[2]!.source, 'c');
});

test('spectral-centroid: totalSources counts groups before validity drops', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'good'),
    ...series([1, 2], 'tooShort'),
  ];
  const r = buildSourceRowTokenSpectralCentroid(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowMinRows, 1);
});

// ----- 0.6.149 refinement: --min/--max-centroid-frac-bins threshold filters -----

function multiSourceMixed(): QueueLine[] {
  // Three sources at very different centre frequencies.
  const n = 64;
  const queue: QueueLine[] = [];
  const freqs: Array<[string, number]> = [
    ['lo', 3],
    ['mid', 16],
    ['hi', 28],
  ];
  for (const [src, k] of freqs) {
    const v: number[] = [];
    for (let t = 0; t < n; t++) {
      v.push(500 + 80 * Math.sin((2 * Math.PI * k * t) / n));
    }
    queue.push(...series(v, src));
  }
  return queue;
}

test('spectral-centroid: defaults — min/max centroid-frac-bins null', () => {
  const r = buildSourceRowTokenSpectralCentroid([], { generatedAt: GEN });
  assert.equal(r.minCentroidFracBins, null);
  assert.equal(r.maxCentroidFracBins, null);
  assert.equal(r.droppedBelowMinCentroidFracBins, 0);
  assert.equal(r.droppedAboveMaxCentroidFracBins, 0);
});

test('spectral-centroid: --min-centroid-frac-bins suppresses low-freq sources', () => {
  const r = buildSourceRowTokenSpectralCentroid(multiSourceMixed(), {
    minCentroidFracBins: 0.4,
    generatedAt: GEN,
  });
  // Only 'hi' (centroid ~ 28/32 ~ 0.875) should remain; 'lo' and 'mid' suppressed.
  for (const s of r.sources) {
    assert.ok(s.centroidFractionBins >= 0.4);
  }
  assert.ok(r.droppedBelowMinCentroidFracBins >= 1);
});

test('spectral-centroid: --max-centroid-frac-bins suppresses high-freq sources', () => {
  const r = buildSourceRowTokenSpectralCentroid(multiSourceMixed(), {
    maxCentroidFracBins: 0.4,
    generatedAt: GEN,
  });
  for (const s of r.sources) {
    assert.ok(s.centroidFractionBins <= 0.4);
  }
  assert.ok(r.droppedAboveMaxCentroidFracBins >= 1);
});

test('spectral-centroid: min and max combine — band-pass on centroid', () => {
  const r = buildSourceRowTokenSpectralCentroid(multiSourceMixed(), {
    minCentroidFracBins: 0.3,
    maxCentroidFracBins: 0.7,
    generatedAt: GEN,
  });
  for (const s of r.sources) {
    assert.ok(s.centroidFractionBins >= 0.3);
    assert.ok(s.centroidFractionBins <= 0.7);
  }
});

test('spectral-centroid: min > max throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralCentroid([], {
        minCentroidFracBins: 0.7,
        maxCentroidFracBins: 0.3,
      }),
    /minCentroidFracBins.*maxCentroidFracBins/,
  );
});

test('spectral-centroid: non-finite minCentroidFracBins throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralCentroid([], {
        minCentroidFracBins: Number.NaN,
      }),
    /minCentroidFracBins/,
  );
});

test('spectral-centroid: non-finite maxCentroidFracBins throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralCentroid([], {
        maxCentroidFracBins: Number.POSITIVE_INFINITY,
      }),
    /maxCentroidFracBins/,
  );
});

test('spectral-centroid: filter is post-compute — does not affect retained values', () => {
  const baseline = buildSourceRowTokenSpectralCentroid(multiSourceMixed(), {
    generatedAt: GEN,
  });
  const filtered = buildSourceRowTokenSpectralCentroid(multiSourceMixed(), {
    minCentroidFracBins: 0.2,
    generatedAt: GEN,
  });
  for (const f of filtered.sources) {
    const b = baseline.sources.find((s) => s.source === f.source)!;
    assert.equal(f.centroidBin, b.centroidBin);
    assert.equal(f.centroidFractionBins, b.centroidFractionBins);
  }
});

test('spectral-centroid: filter applied before --top cap', () => {
  // 5 sources, suppress the 2 lowest, then cap to top 2.
  const queue: QueueLine[] = [];
  const n = 32;
  for (let s = 0; s < 5; s++) {
    const k = 2 + s * 5; // ks: 2, 7, 12, 17, 22
    const v: number[] = [];
    for (let t = 0; t < n; t++) {
      v.push(300 + 50 * Math.sin((2 * Math.PI * k * t) / n));
    }
    queue.push(...series(v, `s-${s}`));
  }
  const r = buildSourceRowTokenSpectralCentroid(queue, {
    minCentroidFracBins: 0.4,
    top: 2,
    sort: 'centroid-asc',
    generatedAt: GEN,
  });
  assert.ok(r.sources.length <= 2);
  assert.ok(r.droppedBelowMinCentroidFracBins >= 1);
  for (const s of r.sources) {
    assert.ok(s.centroidFractionBins >= 0.4);
  }
});

test('spectral-centroid: schema includes new threshold fields', () => {
  const r = buildSourceRowTokenSpectralCentroid([], {
    minCentroidFracBins: 0.1,
    maxCentroidFracBins: 0.9,
    generatedAt: GEN,
  });
  assert.equal(r.minCentroidFracBins, 0.1);
  assert.equal(r.maxCentroidFracBins, 0.9);
  for (const key of [
    'droppedBelowMinCentroidFracBins',
    'droppedAboveMaxCentroidFracBins',
  ]) {
    assert.ok(key in r, `missing ${key}`);
    assert.equal((r as unknown as Record<string, number>)[key], 0);
  }
});
