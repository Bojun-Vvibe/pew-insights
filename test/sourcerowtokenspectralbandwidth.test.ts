import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenSpectralBandwidth } from '../src/sourcerowtokenspectralbandwidth.js';
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

test('spectral-bandwidth: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenSpectralBandwidth([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.minBandwidthFracBins, null);
  assert.equal(r.maxBandwidthFracBins, null);
  assert.equal(r.sort, 'bandwidth-asc');
  assert.equal(r.generatedAt, GEN);
});

test('spectral-bandwidth: pure single-tone sine -> near-zero bandwidth', () => {
  const n = 64;
  const k = 7;
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    v.push(1000 + 100 * Math.sin((2 * Math.PI * k * t) / n));
  }
  const r = buildSourceRowTokenSpectralBandwidth(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  // A single-tone series concentrates all PSD on one bin -> bandwidth ~ 0.
  assert.ok(
    r.sources[0]!.bandwidthBin < 1e-6,
    `single-tone bandwidthBin ~ 0, got ${r.sources[0]!.bandwidthBin}`,
  );
  assert.ok(
    r.sources[0]!.bandwidthFractionBins < 1e-6,
    `single-tone bandwidthFractionBins ~ 0, got ${r.sources[0]!.bandwidthFractionBins}`,
  );
  assert.ok(
    r.sources[0]!.bandwidthFractionMax < 1e-6,
    `single-tone bandwidthFractionMax ~ 0, got ${r.sources[0]!.bandwidthFractionMax}`,
  );
});

test('spectral-bandwidth: two-tone sine at band ends -> wide bandwidth', () => {
  const n = 64;
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    // Equal-amplitude tones near bins 1 and 31 (= K - 1).
    v.push(
      100 * Math.sin((2 * Math.PI * 1 * t) / n) +
        100 * Math.sin((2 * Math.PI * 31 * t) / n),
    );
  }
  const r = buildSourceRowTokenSpectralBandwidth(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  // Two-tone PSD at the band ends: bandwidthFractionMax should be high.
  assert.ok(
    r.sources[0]!.bandwidthFractionMax > 0.8,
    `two-tone band-ends bandwidthFractionMax > 0.8, got ${r.sources[0]!.bandwidthFractionMax}`,
  );
});

test('spectral-bandwidth: two-tone is wider than single-tone (orthogonal-to-centroid demo)', () => {
  const n = 64;
  const single: number[] = [];
  const dual: number[] = [];
  for (let t = 0; t < n; t++) {
    // Single tone at bin 16.
    single.push(1000 + 100 * Math.sin((2 * Math.PI * 16 * t) / n));
    // Two tones at bins 8 and 24, symmetric around 16: same centroid (~16),
    // but markedly wider bandwidth.
    dual.push(
      1000 +
        100 * Math.sin((2 * Math.PI * 8 * t) / n) +
        100 * Math.sin((2 * Math.PI * 24 * t) / n),
    );
  }
  const rs = buildSourceRowTokenSpectralBandwidth(series(single, 's-single'), {
    generatedAt: GEN,
  });
  const rd = buildSourceRowTokenSpectralBandwidth(series(dual, 's-dual'), {
    generatedAt: GEN,
  });
  // Centroids should be close (both ~16) but bandwidth must differ.
  assert.ok(
    Math.abs(rs.sources[0]!.centroidBin - rd.sources[0]!.centroidBin) < 1.0,
    `centroids near-equal: ${rs.sources[0]!.centroidBin} vs ${rd.sources[0]!.centroidBin}`,
  );
  assert.ok(
    rd.sources[0]!.bandwidthBin > rs.sources[0]!.bandwidthBin + 1.0,
    `dual-tone bandwidth (${rd.sources[0]!.bandwidthBin}) > single-tone bandwidth (${rs.sources[0]!.bandwidthBin}) — orthogonal to centroid`,
  );
});

test('spectral-bandwidth: scale invariance — multiplying series by c>0 leaves bandwidth fixed', () => {
  const v: number[] = [];
  for (let t = 0; t < 64; t++) {
    v.push(500 + 50 * Math.sin((2 * Math.PI * 7 * t) / 64) + 30 * Math.sin((2 * Math.PI * 13 * t) / 64));
  }
  const r1 = buildSourceRowTokenSpectralBandwidth(series(v), { generatedAt: GEN });
  const r2 = buildSourceRowTokenSpectralBandwidth(
    series(v.map((x) => x * 1000)),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r1.sources[0]!.bandwidthBin - r2.sources[0]!.bandwidthBin) < 1e-6,
    `scale invariance: ${r1.sources[0]!.bandwidthBin} vs ${r2.sources[0]!.bandwidthBin}`,
  );
  assert.ok(
    Math.abs(
      r1.sources[0]!.bandwidthFractionBins -
        r2.sources[0]!.bandwidthFractionBins,
    ) < 1e-9,
  );
});

test('spectral-bandwidth: DC-shift invariance — adding constant leaves bandwidth fixed (mean-centering removes DC)', () => {
  const v: number[] = [];
  for (let t = 0; t < 64; t++) {
    v.push(50 * Math.sin((2 * Math.PI * 9 * t) / 64) + 20 * Math.sin((2 * Math.PI * 21 * t) / 64));
  }
  const r1 = buildSourceRowTokenSpectralBandwidth(
    series(v.map((x) => x + 1000)),
    { generatedAt: GEN },
  );
  const r2 = buildSourceRowTokenSpectralBandwidth(
    series(v.map((x) => x + 50000)),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r1.sources[0]!.bandwidthBin - r2.sources[0]!.bandwidthBin) < 1e-6,
  );
});

test('spectral-bandwidth: bandwidthFractionMax is in [0, 1] across many shapes', () => {
  const shapes = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [10, 1, 10, 1, 10, 1, 10, 1],
    [1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
    [5, 5, 5, 5, 5, 6, 5, 5, 5, 5],
    [100, 50, 200, 75, 150, 25, 175, 125, 60, 90, 110, 80],
  ];
  const queue: QueueLine[] = [];
  shapes.forEach((vals, idx) => queue.push(...series(vals, `src-${idx}`)));
  const r = buildSourceRowTokenSpectralBandwidth(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, shapes.length);
  for (const row of r.sources) {
    assert.ok(
      row.bandwidthFractionMax >= -1e-12 && row.bandwidthFractionMax <= 1 + 1e-12,
      `bandwidthFractionMax in [0,1] for ${row.source}: ${row.bandwidthFractionMax}`,
    );
    assert.ok(
      row.bandwidthFractionBins >= -1e-12 && row.bandwidthFractionBins <= 1 + 1e-12,
    );
    assert.ok(row.bandwidthBin >= -1e-12);
  }
});

test('spectral-bandwidth: minRows < 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralBandwidth([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-bandwidth: non-integer minRows throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralBandwidth([], { minRows: 5.5 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-bandwidth: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralBandwidth([], {
        // @ts-expect-error testing runtime guard
        sort: 'nope',
      }),
    /sort must be one of/,
  );
});

test('spectral-bandwidth: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralBandwidth([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('spectral-bandwidth: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralBandwidth([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('spectral-bandwidth: top must be a positive integer', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralBandwidth([], { top: 0 }),
    /top must be a positive integer/,
  );
  assert.throws(
    () => buildSourceRowTokenSpectralBandwidth([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});

test('spectral-bandwidth: minBandwidthFracBins must be finite', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralBandwidth([], {
        minBandwidthFracBins: Number.NaN,
      }),
    /minBandwidthFracBins must be a finite number/,
  );
});

test('spectral-bandwidth: maxBandwidthFracBins must be finite', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralBandwidth([], {
        maxBandwidthFracBins: Number.POSITIVE_INFINITY,
      }),
    /maxBandwidthFracBins must be a finite number/,
  );
});

test('spectral-bandwidth: min > max throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralBandwidth([], {
        minBandwidthFracBins: 0.6,
        maxBandwidthFracBins: 0.4,
      }),
    /must be <=/,
  );
});

test('spectral-bandwidth: short series surfaces under droppedBelowMinRows', () => {
  const v = [1, 2, 3, 4, 5];
  const r = buildSourceRowTokenSpectralBandwidth(series(v), {
    generatedAt: GEN,
    minRows: 8,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('spectral-bandwidth: constant series surfaces under droppedConstantSeries', () => {
  const v = [42, 42, 42, 42, 42, 42, 42, 42, 42, 42];
  const r = buildSourceRowTokenSpectralBandwidth(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedConstantSeries, 1);
  assert.equal(r.sources.length, 0);
});

test('spectral-bandwidth: invalid hour_start increments dropInvalidHourStart and is excluded', () => {
  const queue = [
    ql('not-a-date', 's', 5),
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  ];
  const r = buildSourceRowTokenSpectralBandwidth(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('spectral-bandwidth: negative total_tokens dropped', () => {
  const base = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const queue = [...base, ql('2026-05-01T00:00:00Z', 's', -3)];
  const r = buildSourceRowTokenSpectralBandwidth(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('spectral-bandwidth: NaN total_tokens dropped', () => {
  const base = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const queue = [...base, ql('2026-05-01T00:00:00Z', 's', Number.NaN)];
  const r = buildSourceRowTokenSpectralBandwidth(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('spectral-bandwidth: source filter drops non-matching rows', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'a'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'b'),
  ];
  const r = buildSourceRowTokenSpectralBandwidth(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.droppedSourceFilter, 10);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('spectral-bandwidth: top cap surfaces droppedBelowTopCap', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 5; s++) {
    queue.push(...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10 + s], `src-${s}`));
  }
  const r = buildSourceRowTokenSpectralBandwidth(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 3);
});

test('spectral-bandwidth: min/max bandwidth-frac-bins refinement filters with counters', () => {
  const queue: QueueLine[] = [];
  // Single-tone => narrow.
  const narrow: number[] = [];
  for (let t = 0; t < 64; t++) narrow.push(1000 + 100 * Math.sin((2 * Math.PI * 8 * t) / 64));
  // Two-tone band-end => wide.
  const wide: number[] = [];
  for (let t = 0; t < 64; t++) {
    wide.push(
      100 * Math.sin((2 * Math.PI * 1 * t) / 64) +
        100 * Math.sin((2 * Math.PI * 31 * t) / 64),
    );
  }
  queue.push(...series(narrow, 'narrow'));
  queue.push(...series(wide, 'wide'));
  // Drop narrow with min filter.
  const rMin = buildSourceRowTokenSpectralBandwidth(queue, {
    generatedAt: GEN,
    minBandwidthFracBins: 0.4,
  });
  assert.equal(rMin.sources.length, 1);
  assert.equal(rMin.sources[0]!.source, 'wide');
  assert.equal(rMin.droppedBelowMinBandwidthFracBins, 1);
  // Drop wide with max filter.
  const rMax = buildSourceRowTokenSpectralBandwidth(queue, {
    generatedAt: GEN,
    maxBandwidthFracBins: 0.4,
  });
  assert.equal(rMax.sources.length, 1);
  assert.equal(rMax.sources[0]!.source, 'narrow');
  assert.equal(rMax.droppedAboveMaxBandwidthFracBins, 1);
});

test('spectral-bandwidth: sort=bandwidth-desc puts widest first', () => {
  const queue: QueueLine[] = [];
  const narrow: number[] = [];
  for (let t = 0; t < 64; t++) narrow.push(1000 + 100 * Math.sin((2 * Math.PI * 8 * t) / 64));
  const wide: number[] = [];
  for (let t = 0; t < 64; t++) {
    wide.push(
      100 * Math.sin((2 * Math.PI * 1 * t) / 64) +
        100 * Math.sin((2 * Math.PI * 31 * t) / 64),
    );
  }
  queue.push(...series(narrow, 'narrow'));
  queue.push(...series(wide, 'wide'));
  const r = buildSourceRowTokenSpectralBandwidth(queue, {
    generatedAt: GEN,
    sort: 'bandwidth-desc',
  });
  assert.equal(r.sources[0]!.source, 'wide');
  assert.equal(r.sources[1]!.source, 'narrow');
});

test('spectral-bandwidth: JSON shape lock — keys present in expected order', () => {
  const r = buildSourceRowTokenSpectralBandwidth(
    series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    { generatedAt: GEN },
  );
  const reportKeys = Object.keys(r);
  assert.deepEqual(reportKeys, [
    'generatedAt',
    'windowStart',
    'windowEnd',
    'source',
    'minRows',
    'top',
    'minBandwidthFracBins',
    'maxBandwidthFracBins',
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
    'droppedBelowMinBandwidthFracBins',
    'droppedAboveMaxBandwidthFracBins',
    'droppedBelowTopCap',
    'sources',
  ]);
  assert.equal(r.sources.length, 1);
  const rowKeys = Object.keys(r.sources[0]!);
  assert.deepEqual(rowKeys, [
    'source',
    'rowsKept',
    'bins',
    'totalPower',
    'centroidBin',
    'bandwidthBin',
    'bandwidthFractionBins',
    'bandwidthFractionMax',
  ]);
});

test('spectral-bandwidth: tiebreak is source asc when bandwidth ties', () => {
  // Two identical series under different source names -> identical bandwidth -> tiebreak.
  const queue: QueueLine[] = [];
  const v: number[] = [];
  for (let t = 0; t < 32; t++) v.push(100 + 30 * Math.sin((2 * Math.PI * 5 * t) / 32));
  queue.push(...series(v, 'zeta'));
  queue.push(...series(v, 'alpha'));
  const r = buildSourceRowTokenSpectralBandwidth(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('spectral-bandwidth: filter applies before top cap (compose order)', () => {
  // Build 5 sources with monotonically increasing bandwidth fractions
  // by mixing single-tone with progressively more two-tone energy.
  const queue: QueueLine[] = [];
  for (let s = 0; s < 5; s++) {
    const v: number[] = [];
    for (let t = 0; t < 64; t++) {
      const main = 100 * Math.sin((2 * Math.PI * 16 * t) / 64);
      const spread =
        s * 30 * Math.sin((2 * Math.PI * 1 * t) / 64) +
        s * 30 * Math.sin((2 * Math.PI * 31 * t) / 64);
      v.push(1000 + main + spread);
    }
    queue.push(...series(v, `s-${s}`));
  }
  // Filter narrows the candidate set, *then* top caps.
  // With min=0.05 we expect to drop the very narrowest (s-0),
  // and then top=2 caps the remaining 4 to 2.
  const r = buildSourceRowTokenSpectralBandwidth(queue, {
    generatedAt: GEN,
    minBandwidthFracBins: 0.05,
    top: 2,
  });
  // The source dropped under the min filter must NOT be counted under
  // droppedBelowTopCap — verifies "filter then cap" composition order.
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowMinBandwidthFracBins, 1);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('spectral-bandwidth: bandwidthFractionMax matches bandwidthBin / ((bins-1)/2) exactly', () => {
  // Property check: the normalised metric is exactly the documented ratio,
  // not an approximation. Locks the formula against accidental drift.
  const v: number[] = [];
  for (let t = 0; t < 40; t++) {
    v.push(100 + 50 * Math.sin((2 * Math.PI * 3 * t) / 40) + 30 * Math.sin((2 * Math.PI * 17 * t) / 40));
  }
  const r = buildSourceRowTokenSpectralBandwidth(series(v), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  const expected = row.bandwidthBin / ((row.bins - 1) / 2);
  assert.ok(
    Math.abs(row.bandwidthFractionMax - expected) < 1e-12,
    `bandwidthFractionMax = bandwidthBin / ((bins-1)/2): got ${row.bandwidthFractionMax}, expected ${expected}`,
  );
});
