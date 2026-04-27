import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenSpectralEntropy } from '../src/sourcerowtokenspectralentropy.js';
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
  // Add a large DC offset to keep total_tokens >= 0. DC offset is
  // removed by mean-centering so it does not affect PSD-derived
  // quantities.
  const DC = 100000;
  return values.map((v, i) => {
    const hh = Math.floor(i / 60) % 24;
    const mm = i % 60;
    const day = 25 + Math.floor(i / (24 * 60));
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v + DC,
    );
  });
}

test('spectral-entropy: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenSpectralEntropy([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'norm-desc');
  assert.equal(r.generatedAt, GEN);
});

test('spectral-entropy: report fields are wired through', () => {
  const r = buildSourceRowTokenSpectralEntropy([], {
    generatedAt: GEN,
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-30T00:00:00Z',
    source: 'sx',
    minRows: 8,
    top: 5,
    sort: 'entropy-desc',
  });
  assert.equal(r.windowStart, '2026-04-25T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00Z');
  assert.equal(r.source, 'sx');
  assert.equal(r.minRows, 8);
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'entropy-desc');
});

test('spectral-entropy: minRows non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralEntropy([], { minRows: 4.5 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-entropy: minRows < 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralEntropy([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-entropy: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralEntropy([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('spectral-entropy: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralEntropy([], {
        // @ts-expect-error - intentionally invalid
        sort: 'wat',
      }),
    /sort must be one of/,
  );
});

test('spectral-entropy: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralEntropy([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('spectral-entropy: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralEntropy([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('spectral-entropy: bad hour_start counted under droppedInvalidHourStart', () => {
  const q = [ql('garbage', 's', 100), ql('also-bad', 's', 100)];
  const r = buildSourceRowTokenSpectralEntropy(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 2);
});

test('spectral-entropy: NaN total_tokens counted under droppedInvalidTokens', () => {
  const q = series([1, 2, 3, 4, 5, 6, 7, 8]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (q[0] as any).total_tokens = Number.NaN;
  const r = buildSourceRowTokenSpectralEntropy(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('spectral-entropy: negative total_tokens counted under droppedNegativeTokens', () => {
  const q = series([1, 2, 3, 4, 5, 6, 7, 8]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (q[0] as any).total_tokens = -5;
  const r = buildSourceRowTokenSpectralEntropy(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('spectral-entropy: source filter counts non-matching under droppedSourceFilter', () => {
  const a = series([1, 2, 3, 4, 5, 6, 7, 8], 'a');
  const b = series([1, 2, 3, 4, 5, 6, 7, 8], 'b');
  const r = buildSourceRowTokenSpectralEntropy([...a, ...b], {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.droppedSourceFilter, 8);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('spectral-entropy: below min-rows surfaces under droppedBelowMinRows', () => {
  const r = buildSourceRowTokenSpectralEntropy(series([1, 2, 3, 4]), {
    generatedAt: GEN,
    minRows: 8,
  });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('spectral-entropy: constant series surfaces under droppedConstantSeries', () => {
  const r = buildSourceRowTokenSpectralEntropy(
    series([5, 5, 5, 5, 5, 5, 5, 5]),
    { generatedAt: GEN },
  );
  assert.equal(r.droppedConstantSeries, 1);
  assert.equal(r.sources.length, 0);
});

test('spectral-entropy: row.bins == floor(n/2)', () => {
  const r = buildSourceRowTokenSpectralEntropy(
    series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.bins, 5);
  assert.equal(r.sources[0]!.rowsKept, 10);
});

test('spectral-entropy: entropyNorm in [0, 1] for arbitrary inputs', () => {
  const patterns: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [1, 8, 1, 8, 1, 8, 1, 8],
    [1, 1, 1, 8, 8, 8, 1, 1, 1, 8],
    [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8],
    [10, 0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0],
  ];
  for (const p of patterns) {
    const r = buildSourceRowTokenSpectralEntropy(series(p, 's'), {
      generatedAt: GEN,
      minRows: 4,
    });
    assert.equal(r.sources.length, 1, `pattern ${JSON.stringify(p)}`);
    const n = r.sources[0]!.entropyNorm;
    assert.ok(
      n >= -1e-12 && n <= 1 + 1e-12,
      `entropyNorm ${n} should be in [0,1] for pattern ${JSON.stringify(p)}`,
    );
  }
});

test('spectral-entropy: entropyBits == entropyNorm * log2(bins)', () => {
  const r = buildSourceRowTokenSpectralEntropy(
    series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5, 4, 6]),
    { generatedAt: GEN, minRows: 4 },
  );
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  const log2K = Math.log(row.bins) / Math.log(2);
  assert.ok(Math.abs(row.entropyBits - row.entropyNorm * log2K) < 1e-9);
});

test('spectral-entropy: dominantShare in (0, 1] and dominantBin in [1, bins]', () => {
  const r = buildSourceRowTokenSpectralEntropy(
    series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.dominantShare > 0 && row.dominantShare <= 1 + 1e-12);
  assert.ok(row.dominantBin >= 1 && row.dominantBin <= row.bins);
});

test('spectral-entropy: pure tone (sinusoid at single bin) -> entropyNorm near 0', () => {
  // sin at frequency k=2 over n=16 samples -> all power concentrates
  // at bin 2; normalized entropy should be near 0.
  const n = 16;
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    v.push(Math.round(50 * Math.sin((2 * Math.PI * 2 * t) / n)) + 100);
  }
  const r = buildSourceRowTokenSpectralEntropy(series(v, 's'), {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.sources.length, 1);
  // Allow some leakage from the integer rounding, but expect very low
  // normalized entropy and high dominant share.
  assert.ok(
    r.sources[0]!.entropyNorm < 0.4,
    `expected entropyNorm < 0.4 for near-pure tone, got ${r.sources[0]!.entropyNorm}`,
  );
  assert.ok(
    r.sources[0]!.dominantShare > 0.5,
    `expected dominantShare > 0.5 for near-pure tone, got ${r.sources[0]!.dominantShare}`,
  );
});

test('spectral-entropy: invariant to additive DC shift', () => {
  // The builder mean-centers the series before FFT, so adding a
  // constant offset must not change the entropy.
  const a = buildSourceRowTokenSpectralEntropy(
    series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5]),
    { generatedAt: GEN },
  );
  const b = buildSourceRowTokenSpectralEntropy(
    series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5].map((x) => x + 50)),
    { generatedAt: GEN },
  );
  assert.equal(a.sources.length, 1);
  assert.equal(b.sources.length, 1);
  assert.ok(
    Math.abs(a.sources[0]!.entropyNorm - b.sources[0]!.entropyNorm) < 1e-9,
  );
});

test('spectral-entropy: invariant to positive scalar multiply (PSD scales uniformly)', () => {
  // Multiplying every sample by a positive constant scales every
  // P[k] by the same factor; the normalized PSD p[k] is unchanged,
  // so entropy must be identical.
  const base = [1, 4, 2, 6, 3, 7, 2, 8, 1, 5];
  const a = buildSourceRowTokenSpectralEntropy(series(base, 's'), {
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenSpectralEntropy(
    series(base.map((x) => x * 7), 's'),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(a.sources[0]!.entropyNorm - b.sources[0]!.entropyNorm) < 1e-9,
  );
});

test('spectral-entropy: time-reversal preserves entropy (PSD is reverse-invariant)', () => {
  const fwd = [1, 4, 2, 6, 3, 7, 2, 8, 1, 5, 4, 6];
  const rev = [...fwd].reverse();
  const a = buildSourceRowTokenSpectralEntropy(series(fwd, 'a'), {
    generatedAt: GEN,
    minRows: 4,
  });
  const b = buildSourceRowTokenSpectralEntropy(series(rev, 'b'), {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.ok(
    Math.abs(a.sources[0]!.entropyNorm - b.sources[0]!.entropyNorm) < 1e-9,
  );
});

test('spectral-entropy: tonal series has lower entropyNorm than smooth ramp (in this lens)', () => {
  // Tonal (pure-frequency-like) sequence concentrates PSD mass at one
  // bin; a smooth monotone ramp distributes mass more broadly across
  // low frequencies. Either way, the tonal sequence should have
  // strictly lower normalized entropy than the broadband ramp.
  const tonal: number[] = [];
  const N = 16;
  for (let t = 0; t < N; t++) {
    tonal.push(Math.round(40 * Math.sin((2 * Math.PI * 3 * t) / N)) + 100);
  }
  const ramp: number[] = [];
  for (let t = 0; t < N; t++) ramp.push(t * 7 + 5);
  const a = buildSourceRowTokenSpectralEntropy(series(tonal, 'a'), {
    generatedAt: GEN,
    minRows: 4,
  });
  const b = buildSourceRowTokenSpectralEntropy(series(ramp, 'b'), {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.ok(
    a.sources[0]!.entropyNorm < b.sources[0]!.entropyNorm,
    `expected tonal (${a.sources[0]!.entropyNorm}) < ramp (${b.sources[0]!.entropyNorm})`,
  );
});

test('spectral-entropy: sort norm-desc orders most broadband first', () => {
  const tonal: number[] = [];
  const N = 16;
  for (let t = 0; t < N; t++) {
    tonal.push(Math.round(40 * Math.sin((2 * Math.PI * 3 * t) / N)) + 100);
  }
  const broad: number[] = [];
  for (let t = 0; t < N; t++) broad.push(((t * 13 + 5) % 17) + 50);
  const r = buildSourceRowTokenSpectralEntropy(
    [...series(tonal, 'tonal'), ...series(broad, 'broad')],
    { generatedAt: GEN, sort: 'norm-desc', minRows: 4 },
  );
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.entropyNorm >= r.sources[1]!.entropyNorm);
});

test('spectral-entropy: sort norm-asc orders most tonal first', () => {
  const tonal: number[] = [];
  const N = 16;
  for (let t = 0; t < N; t++) {
    tonal.push(Math.round(40 * Math.sin((2 * Math.PI * 3 * t) / N)) + 100);
  }
  const broad: number[] = [];
  for (let t = 0; t < N; t++) broad.push(((t * 13 + 5) % 17) + 50);
  const r = buildSourceRowTokenSpectralEntropy(
    [...series(tonal, 'tonal'), ...series(broad, 'broad')],
    { generatedAt: GEN, sort: 'norm-asc', minRows: 4 },
  );
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.entropyNorm <= r.sources[1]!.entropyNorm);
});

test('spectral-entropy: sort entropy-desc orders highest bits first', () => {
  const a = series([1, 1, 1, 8, 1, 1, 1, 1, 1, 1], 'a');
  const b = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'b');
  const r = buildSourceRowTokenSpectralEntropy([...a, ...b], {
    generatedAt: GEN,
    sort: 'entropy-desc',
    minRows: 4,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.entropyBits >= r.sources[1]!.entropyBits);
});

test('spectral-entropy: sort entropy-asc orders lowest bits first', () => {
  const a = series([1, 1, 1, 8, 1, 1, 1, 1, 1, 1], 'a');
  const b = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'b');
  const r = buildSourceRowTokenSpectralEntropy([...a, ...b], {
    generatedAt: GEN,
    sort: 'entropy-asc',
    minRows: 4,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.entropyBits <= r.sources[1]!.entropyBits);
});

test('spectral-entropy: sort dom-share-desc orders most concentrated first', () => {
  const a = series([1, 1, 1, 8, 1, 1, 1, 1, 1, 1], 'a');
  const b = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'b');
  const r = buildSourceRowTokenSpectralEntropy([...a, ...b], {
    generatedAt: GEN,
    sort: 'dom-share-desc',
    minRows: 4,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.dominantShare >= r.sources[1]!.dominantShare);
});

test('spectral-entropy: sort source asc breaks ties lexically', () => {
  const a = series([1, 4, 2, 6, 3, 7, 2, 8], 'aa');
  const b = series([1, 4, 2, 6, 3, 7, 2, 8], 'bb');
  const c = series([1, 4, 2, 6, 3, 7, 2, 8], 'cc');
  const r = buildSourceRowTokenSpectralEntropy([...c, ...a, ...b], {
    generatedAt: GEN,
    sort: 'source',
    minRows: 4,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['aa', 'bb', 'cc'],
  );
});

test('spectral-entropy: sort rows orders by rowsKept desc', () => {
  const a = series([1, 4, 2, 6, 3, 7, 2, 8], 'a');
  const b = series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5, 4, 6, 2, 9, 3], 'b');
  const r = buildSourceRowTokenSpectralEntropy([...a, ...b], {
    generatedAt: GEN,
    sort: 'rows',
    minRows: 4,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[1]!.source, 'a');
});

test('spectral-entropy: top cap surfaces suppressed rows under droppedBelowTopCap', () => {
  const a = series([1, 4, 2, 6, 3, 7, 2, 8], 'a');
  const b = series([1, 1, 1, 8, 1, 1, 1, 1], 'b');
  const c = series([2, 3, 5, 7, 11, 13, 17, 19], 'c');
  const r = buildSourceRowTokenSpectralEntropy([...a, ...b, ...c], {
    generatedAt: GEN,
    sort: 'norm-desc',
    minRows: 4,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('spectral-entropy: window filtering trims out-of-range rows silently', () => {
  // out-of-window rows are silently dropped (they neither count as
  // bad hour_start nor as below-min-rows for the *kept* portion).
  const v = series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5, 4, 6, 2, 9, 3, 5], 's');
  const r = buildSourceRowTokenSpectralEntropy(v, {
    generatedAt: GEN,
    minRows: 4,
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-25T00:08:00Z', // keeps first 8 rows
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 8);
});

test('spectral-entropy: totalRowsKept counts pre-min-rows rows per source', () => {
  // totalRowsKept is the sum of all rows that survived parse / window
  // / source filter, *before* the per-source min-rows gate.
  const a = series([1, 2, 3], 'a'); // 3 rows, dropped under min-rows
  const b = series([1, 4, 2, 6, 3, 7, 2, 8], 'b'); // 8 rows, kept
  const r = buildSourceRowTokenSpectralEntropy([...a, ...b], {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.totalRowsKept, 11);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
});

test('spectral-entropy: generatedAt defaults to now when not provided', () => {
  const r = buildSourceRowTokenSpectralEntropy([]);
  assert.ok(typeof r.generatedAt === 'string' && r.generatedAt.length > 0);
});

test('spectral-entropy: out-of-order input rows are sorted by hour_start before FFT', () => {
  // The PSD is a function of the time-ordered sequence. The builder
  // must sort by hour_start before computing the DFT, so two input
  // permutations of the same (time, value) pairs must produce the
  // same entropy.
  const fwd = series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5, 4, 6], 's');
  const shuffled = [
    fwd[3]!, fwd[7]!, fwd[1]!, fwd[10]!, fwd[5]!, fwd[0]!,
    fwd[11]!, fwd[2]!, fwd[8]!, fwd[4]!, fwd[6]!, fwd[9]!,
  ];
  const a = buildSourceRowTokenSpectralEntropy(fwd, {
    generatedAt: GEN,
    minRows: 4,
  });
  const b = buildSourceRowTokenSpectralEntropy(shuffled, {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.ok(
    Math.abs(a.sources[0]!.entropyNorm - b.sources[0]!.entropyNorm) < 1e-9,
  );
});
