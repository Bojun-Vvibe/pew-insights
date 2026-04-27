import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenSpectralSkewness } from '../src/sourcerowtokenspectralskewness.js';
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
  // Add a large DC offset to keep total_tokens >= 0 (negatives are dropped
  // by the builder). DC offset is removed by the builder's mean-centering
  // step, so it does NOT change PSD-derived quantities.
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

test('spectral-skewness: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenSpectralSkewness([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.minSkewness, null);
  assert.equal(r.maxSkewness, null);
  assert.equal(r.sort, 'skewness-asc');
  assert.equal(r.generatedAt, GEN);
});

test('spectral-skewness: symmetric two-tone around midpoint -> ~zero skewness', () => {
  const n = 128;
  const K = n / 2; // 64
  // Two tones placed symmetrically around K/2 = 32: bins 8 and 56 (32-24, 32+24).
  // Equal amplitude -> PSD is symmetric around centroid = 32 -> skewness ~ 0.
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    v.push(
      1000 +
        100 * Math.sin((2 * Math.PI * 8 * t) / n) +
        100 * Math.sin((2 * Math.PI * 56 * t) / n),
    );
  }
  const r = buildSourceRowTokenSpectralSkewness(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(
    Math.abs(r.sources[0]!.skewness) < 1e-6,
    `symmetric two-tone |skewness| ~ 0, got ${r.sources[0]!.skewness}`,
  );
  // Sanity: centroid should be ~32 (n/4).
  assert.ok(
    Math.abs(r.sources[0]!.centroidBin - 32) < 0.5,
    `symmetric centroid ~ 32, got ${r.sources[0]!.centroidBin}`,
  );
});

test('spectral-skewness: low-bin spike + high-bin spike asymmetry -> sign flips correctly', () => {
  const n = 128;
  // Big spike near bin 5, small spike near bin 50: centroid sits low,
  // long high-frequency tail -> POSITIVE skewness.
  const vPos: number[] = [];
  for (let t = 0; t < n; t++) {
    vPos.push(
      1000 +
        500 * Math.sin((2 * Math.PI * 5 * t) / n) +
        50 * Math.sin((2 * Math.PI * 50 * t) / n),
    );
  }
  // Mirror image: big spike near bin 60 (high), small spike near bin 5 -> centroid high,
  // long low-frequency tail -> NEGATIVE skewness.
  const vNeg: number[] = [];
  for (let t = 0; t < n; t++) {
    vNeg.push(
      1000 +
        50 * Math.sin((2 * Math.PI * 5 * t) / n) +
        500 * Math.sin((2 * Math.PI * 60 * t) / n),
    );
  }
  const rPos = buildSourceRowTokenSpectralSkewness(series(vPos, 'pos'), {
    generatedAt: GEN,
  });
  const rNeg = buildSourceRowTokenSpectralSkewness(series(vNeg, 'neg'), {
    generatedAt: GEN,
  });
  assert.ok(
    rPos.sources[0]!.skewness > 0.5,
    `positive-skew expected > 0.5, got ${rPos.sources[0]!.skewness}`,
  );
  assert.ok(
    rNeg.sources[0]!.skewness < -0.5,
    `negative-skew expected < -0.5, got ${rNeg.sources[0]!.skewness}`,
  );
});

test('spectral-skewness: scale invariance — multiplying series by c>0 leaves skewness fixed', () => {
  const v: number[] = [];
  for (let t = 0; t < 64; t++) {
    v.push(
      500 +
        50 * Math.sin((2 * Math.PI * 5 * t) / 64) +
        15 * Math.sin((2 * Math.PI * 25 * t) / 64),
    );
  }
  const r1 = buildSourceRowTokenSpectralSkewness(series(v), { generatedAt: GEN });
  const r2 = buildSourceRowTokenSpectralSkewness(
    series(v.map((x) => x * 1000)),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r1.sources[0]!.skewness - r2.sources[0]!.skewness) < 1e-9,
    `scale invariance: ${r1.sources[0]!.skewness} vs ${r2.sources[0]!.skewness}`,
  );
});

test('spectral-skewness: DC-shift invariance — adding constant leaves skewness fixed', () => {
  const v: number[] = [];
  for (let t = 0; t < 64; t++) {
    v.push(
      50 * Math.sin((2 * Math.PI * 4 * t) / 64) +
        20 * Math.sin((2 * Math.PI * 27 * t) / 64),
    );
  }
  const r1 = buildSourceRowTokenSpectralSkewness(
    series(v.map((x) => x + 1000)),
    { generatedAt: GEN },
  );
  const r2 = buildSourceRowTokenSpectralSkewness(
    series(v.map((x) => x + 50000)),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r1.sources[0]!.skewness - r2.sources[0]!.skewness) < 1e-9,
  );
});

test('spectral-skewness: orthogonal-to-bandwidth — mirror-image PSDs have opposite-sign skewness', () => {
  const n = 128;
  // PSD with big mass at LOW bin + small mass far HIGH -> centroid pulled
  // towards low; long tail to the right -> POSITIVE skew.
  // DC offset large enough to keep total_tokens >= 0 (negatives are dropped).
  const vPos: number[] = [];
  for (let t = 0; t < n; t++) {
    vPos.push(
      1000 +
        400 * Math.sin((2 * Math.PI * 4 * t) / n) +
        20 * Math.sin((2 * Math.PI * 60 * t) / n),
    );
  }
  // Mirror: big mass HIGH + small mass LOW -> centroid near high; long tail
  // to the left -> NEGATIVE skew.
  const vNeg: number[] = [];
  for (let t = 0; t < n; t++) {
    vNeg.push(
      1000 +
        400 * Math.sin((2 * Math.PI * 60 * t) / n) +
        20 * Math.sin((2 * Math.PI * 4 * t) / n),
    );
  }
  const rPos = buildSourceRowTokenSpectralSkewness(series(vPos, 'pos'), {
    generatedAt: GEN,
  });
  const rNeg = buildSourceRowTokenSpectralSkewness(series(vNeg, 'neg'), {
    generatedAt: GEN,
  });
  assert.equal(rPos.sources.length, 1);
  assert.equal(rNeg.sources.length, 1);
  assert.ok(
    rPos.sources[0]!.skewness > 0,
    `pos expected > 0, got ${rPos.sources[0]!.skewness}`,
  );
  assert.ok(
    rNeg.sources[0]!.skewness < 0,
    `neg expected < 0, got ${rNeg.sources[0]!.skewness}`,
  );
});

test('spectral-skewness: minRows < 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralSkewness([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-skewness: non-integer minRows throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralSkewness([], { minRows: 8.5 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-skewness: rows below minRows surface in droppedBelowMinRows', () => {
  const v: number[] = [1, 2, 3, 4, 5];
  const r = buildSourceRowTokenSpectralSkewness(series(v), {
    generatedAt: GEN,
    minRows: 8,
  });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('spectral-skewness: constant series surfaces in droppedConstantSeries', () => {
  const v = new Array<number>(32).fill(777);
  const r = buildSourceRowTokenSpectralSkewness(series(v), { generatedAt: GEN });
  assert.equal(r.droppedConstantSeries, 1);
  assert.equal(r.sources.length, 0);
});

test('spectral-skewness: invalid hour_start surfaces in droppedInvalidHourStart', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 's', 100),
    ql('2026-04-25T01:00:00Z', 's', 100),
  ];
  const r = buildSourceRowTokenSpectralSkewness(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('spectral-skewness: bad total_tokens (NaN/Infinity) surfaces in droppedInvalidTokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 's', NaN),
    ql('2026-04-25T02:00:00Z', 's', Infinity),
  ];
  const r = buildSourceRowTokenSpectralSkewness(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 2);
});

test('spectral-skewness: negative total_tokens surfaces in droppedNegativeTokens', () => {
  const q: QueueLine[] = [ql('2026-04-25T01:00:00Z', 's', -5)];
  const r = buildSourceRowTokenSpectralSkewness(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('spectral-skewness: source filter narrows to one source and surfaces dropped count', () => {
  const v: number[] = [];
  for (let t = 0; t < 32; t++) v.push(100 + t);
  const q = [...series(v, 'a'), ...series(v, 'b')];
  const r = buildSourceRowTokenSpectralSkewness(q, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('spectral-skewness: since/until window filters', () => {
  const v: number[] = [];
  for (let t = 0; t < 64; t++) v.push(100 + (t % 5));
  const q = series(v);
  const r = buildSourceRowTokenSpectralSkewness(q, {
    generatedAt: GEN,
    since: '2026-04-25T00:30:00Z',
    until: '2026-04-25T00:50:00Z',
  });
  // Window is small -> dropped to below minRows
  assert.equal(r.windowStart, '2026-04-25T00:30:00Z');
  assert.equal(r.windowEnd, '2026-04-25T00:50:00Z');
});

test('spectral-skewness: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralSkewness([], { since: 'garbage' }),
    /invalid since/,
  );
});

test('spectral-skewness: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralSkewness([], { until: 'garbage' }),
    /invalid until/,
  );
});

test('spectral-skewness: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralSkewness([], {
        sort: 'nope' as unknown as 'skewness-asc',
      }),
    /sort must be one of/,
  );
});

test('spectral-skewness: top must be a positive integer', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralSkewness([], { top: 0 }),
    /top must be a positive integer/,
  );
  assert.throws(
    () => buildSourceRowTokenSpectralSkewness([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});

test('spectral-skewness: top caps and surfaces droppedBelowTopCap', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 5; s++) {
    const v: number[] = [];
    for (let t = 0; t < 32; t++) {
      v.push(
        500 +
          50 * Math.sin((2 * Math.PI * (3 + s) * t) / 32) +
          (s + 1) * 10 * Math.sin((2 * Math.PI * 13 * t) / 32),
      );
    }
    queue.push(...series(v, `src-${s}`));
  }
  const r = buildSourceRowTokenSpectralSkewness(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 3);
});

test('spectral-skewness: minSkewness filters and surfaces droppedBelowMinSkewness', () => {
  const n = 64;
  // Source A: positive skew (low big spike + small high spike)
  const vA: number[] = [];
  for (let t = 0; t < n; t++) {
    vA.push(
      400 * Math.sin((2 * Math.PI * 4 * t) / n) +
        20 * Math.sin((2 * Math.PI * 28 * t) / n),
    );
  }
  // Source B: negative skew (mirror image)
  const vB: number[] = [];
  for (let t = 0; t < n; t++) {
    vB.push(
      20 * Math.sin((2 * Math.PI * 4 * t) / n) +
        400 * Math.sin((2 * Math.PI * 28 * t) / n),
    );
  }
  const queue = [...series(vA, 'A'), ...series(vB, 'B')];
  const r = buildSourceRowTokenSpectralSkewness(queue, {
    generatedAt: GEN,
    minSkewness: 0,
  });
  // Only positively skewed source survives.
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
  assert.equal(r.droppedBelowMinSkewness, 1);
});

test('spectral-skewness: maxSkewness filters and surfaces droppedAboveMaxSkewness', () => {
  const n = 64;
  const vA: number[] = [];
  for (let t = 0; t < n; t++) {
    vA.push(
      400 * Math.sin((2 * Math.PI * 4 * t) / n) +
        20 * Math.sin((2 * Math.PI * 28 * t) / n),
    );
  }
  const vB: number[] = [];
  for (let t = 0; t < n; t++) {
    vB.push(
      20 * Math.sin((2 * Math.PI * 4 * t) / n) +
        400 * Math.sin((2 * Math.PI * 28 * t) / n),
    );
  }
  const queue = [...series(vA, 'A'), ...series(vB, 'B')];
  const r = buildSourceRowTokenSpectralSkewness(queue, {
    generatedAt: GEN,
    maxSkewness: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'B');
  assert.equal(r.droppedAboveMaxSkewness, 1);
});

test('spectral-skewness: minSkewness > maxSkewness throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralSkewness([], {
        minSkewness: 1,
        maxSkewness: -1,
      }),
    /must be <=/,
  );
});

test('spectral-skewness: non-finite minSkewness throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralSkewness([], { minSkewness: NaN }),
    /minSkewness must be a finite number/,
  );
});

test('spectral-skewness: non-finite maxSkewness throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralSkewness([], { maxSkewness: Infinity }),
    /maxSkewness must be a finite number/,
  );
});

test('spectral-skewness: sort=skewness-asc puts most-negative first', () => {
  const n = 64;
  const queue: QueueLine[] = [];
  // src1 positive skew, src2 negative skew, src3 ~zero skew (symmetric).
  const v1: number[] = [],
    v2: number[] = [],
    v3: number[] = [];
  for (let t = 0; t < n; t++) {
    v1.push(
      400 * Math.sin((2 * Math.PI * 4 * t) / n) +
        20 * Math.sin((2 * Math.PI * 28 * t) / n),
    );
    v2.push(
      20 * Math.sin((2 * Math.PI * 4 * t) / n) +
        400 * Math.sin((2 * Math.PI * 28 * t) / n),
    );
    // Symmetric two-tone around K/2 = 16.
    v3.push(
      100 * Math.sin((2 * Math.PI * 8 * t) / n) +
        100 * Math.sin((2 * Math.PI * 24 * t) / n),
    );
  }
  queue.push(...series(v1, 'pos'));
  queue.push(...series(v2, 'neg'));
  queue.push(...series(v3, 'mid'));
  const r = buildSourceRowTokenSpectralSkewness(queue, {
    generatedAt: GEN,
    sort: 'skewness-asc',
  });
  assert.equal(r.sources.length, 3);
  assert.equal(r.sources[0]!.source, 'neg');
  assert.equal(r.sources[2]!.source, 'pos');
});

test('spectral-skewness: sort=skewness-desc puts most-positive first', () => {
  const n = 64;
  const queue: QueueLine[] = [];
  const v1: number[] = [],
    v2: number[] = [];
  for (let t = 0; t < n; t++) {
    v1.push(
      400 * Math.sin((2 * Math.PI * 4 * t) / n) +
        20 * Math.sin((2 * Math.PI * 28 * t) / n),
    );
    v2.push(
      20 * Math.sin((2 * Math.PI * 4 * t) / n) +
        400 * Math.sin((2 * Math.PI * 28 * t) / n),
    );
  }
  queue.push(...series(v1, 'pos'));
  queue.push(...series(v2, 'neg'));
  const r = buildSourceRowTokenSpectralSkewness(queue, {
    generatedAt: GEN,
    sort: 'skewness-desc',
  });
  assert.equal(r.sources[0]!.source, 'pos');
  assert.equal(r.sources[1]!.source, 'neg');
});

test('spectral-skewness: sort=abs-skewness-desc puts most-asymmetric first', () => {
  const n = 64;
  const queue: QueueLine[] = [];
  const big: number[] = [],
    small: number[] = [];
  for (let t = 0; t < n; t++) {
    big.push(
      500 * Math.sin((2 * Math.PI * 3 * t) / n) +
        20 * Math.sin((2 * Math.PI * 30 * t) / n),
    );
    small.push(
      100 * Math.sin((2 * Math.PI * 12 * t) / n) +
        80 * Math.sin((2 * Math.PI * 20 * t) / n),
    );
  }
  queue.push(...series(big, 'big'));
  queue.push(...series(small, 'small'));
  const r = buildSourceRowTokenSpectralSkewness(queue, {
    generatedAt: GEN,
    sort: 'abs-skewness-desc',
  });
  assert.ok(
    Math.abs(r.sources[0]!.skewness) >= Math.abs(r.sources[1]!.skewness),
    `abs sort: ${r.sources[0]!.skewness} vs ${r.sources[1]!.skewness}`,
  );
});

test('spectral-skewness: sort=rows orders by rowsKept desc', () => {
  const queue: QueueLine[] = [];
  const v1: number[] = [];
  for (let t = 0; t < 16; t++) v1.push(100 + (t % 3));
  const v2: number[] = [];
  for (let t = 0; t < 32; t++) v2.push(100 + (t % 5));
  queue.push(...series(v1, 'short'));
  queue.push(...series(v2, 'long'));
  const r = buildSourceRowTokenSpectralSkewness(queue, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.sources[1]!.source, 'short');
});

test('spectral-skewness: sort=source orders alphabetically', () => {
  const queue: QueueLine[] = [];
  const v: number[] = [];
  for (let t = 0; t < 16; t++)
    v.push(100 + 50 * Math.sin((2 * Math.PI * 3 * t) / 16));
  queue.push(...series(v, 'zebra'));
  queue.push(...series(v, 'apple'));
  queue.push(...series(v, 'mango'));
  const r = buildSourceRowTokenSpectralSkewness(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['apple', 'mango', 'zebra'],
  );
});

test('spectral-skewness: tiebreak on equal sort keys is source-asc', () => {
  // Two identical PSDs across sources -> ties; tiebreak -> source asc.
  const v: number[] = [];
  for (let t = 0; t < 32; t++)
    v.push(
      100 * Math.sin((2 * Math.PI * 4 * t) / 32) +
        20 * Math.sin((2 * Math.PI * 12 * t) / 32),
    );
  const queue = [
    ...series(v, 'beta'),
    ...series(v, 'alpha'),
    ...series(v, 'gamma'),
  ];
  const r = buildSourceRowTokenSpectralSkewness(queue, {
    generatedAt: GEN,
    sort: 'skewness-asc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'beta', 'gamma'],
  );
});

test('spectral-skewness: bandwidthBin == sqrt(m2) consistency (formula lock)', () => {
  const v: number[] = [];
  for (let t = 0; t < 64; t++) {
    v.push(
      500 +
        50 * Math.sin((2 * Math.PI * 7 * t) / 64) +
        20 * Math.sin((2 * Math.PI * 21 * t) / 64),
    );
  }
  const r = buildSourceRowTokenSpectralSkewness(series(v), { generatedAt: GEN });
  const row = r.sources[0]!;
  // Reconstruct skewness from m3 and bandwidthBin -> should match
  // (modulo floating noise).
  const recon = row.m3 / Math.pow(row.bandwidthBin * row.bandwidthBin, 1.5);
  assert.ok(
    Math.abs(recon - row.skewness) < 1e-9,
    `formula lock: ${recon} vs ${row.skewness}`,
  );
});

test('spectral-skewness: report carries through option echoes', () => {
  const v: number[] = [];
  for (let t = 0; t < 32; t++)
    v.push(100 + 30 * Math.sin((2 * Math.PI * 4 * t) / 32));
  const r = buildSourceRowTokenSpectralSkewness(series(v), {
    generatedAt: GEN,
    minRows: 8,
    top: 1,
    minSkewness: -10,
    maxSkewness: 10,
    sort: 'abs-skewness-desc',
    since: '2026-04-25T00:00:00Z',
    until: '2027-01-01T00:00:00Z',
  });
  assert.equal(r.minRows, 8);
  assert.equal(r.top, 1);
  assert.equal(r.minSkewness, -10);
  assert.equal(r.maxSkewness, 10);
  assert.equal(r.sort, 'abs-skewness-desc');
  assert.equal(r.windowStart, '2026-04-25T00:00:00Z');
  assert.equal(r.windowEnd, '2027-01-01T00:00:00Z');
});

test('spectral-skewness: time-ordered samples — re-shuffling input rows preserves PSD-derived skewness (sorted internally by hour_start)', () => {
  const v: number[] = [];
  for (let t = 0; t < 32; t++)
    v.push(
      400 * Math.sin((2 * Math.PI * 3 * t) / 32) +
        25 * Math.sin((2 * Math.PI * 13 * t) / 32),
    );
  const ordered = series(v);
  const shuffled = [...ordered].reverse();
  const r1 = buildSourceRowTokenSpectralSkewness(ordered, { generatedAt: GEN });
  const r2 = buildSourceRowTokenSpectralSkewness(shuffled, { generatedAt: GEN });
  assert.ok(
    Math.abs(r1.sources[0]!.skewness - r2.sources[0]!.skewness) < 1e-9,
  );
});

test('spectral-skewness: empty source string falls back to "unknown" bucket', () => {
  const v: number[] = [];
  for (let t = 0; t < 16; t++)
    v.push(100 + 30 * Math.sin((2 * Math.PI * 4 * t) / 16));
  const queue = series(v, '');
  const r = buildSourceRowTokenSpectralSkewness(queue, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('spectral-skewness: composition order — minSkewness applied before top cap (drops surface in their own bucket)', () => {
  const n = 64;
  const queue: QueueLine[] = [];
  // Two positively-skewed and two negatively-skewed sources.
  for (let s = 0; s < 4; s++) {
    const big = s % 2 === 0 ? [4, 28] : [28, 4];
    const v: number[] = [];
    for (let t = 0; t < n; t++) {
      v.push(
        400 * Math.sin((2 * Math.PI * big[0]! * t) / n) +
          20 * Math.sin((2 * Math.PI * big[1]! * t) / n),
      );
    }
    queue.push(...series(v, `s-${s}`));
  }
  const r = buildSourceRowTokenSpectralSkewness(queue, {
    generatedAt: GEN,
    minSkewness: 0,
    top: 1,
    sort: 'skewness-desc',
  });
  // 4 sources -> 2 dropped under min, then 1 capped, 1 surviving.
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowMinSkewness, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});
