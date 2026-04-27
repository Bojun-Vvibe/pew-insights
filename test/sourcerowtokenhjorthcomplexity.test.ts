import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenHjorthComplexity } from '../src/sourcerowtokenhjorthcomplexity.js';
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

const GEN = '2026-04-27T12:00:00.000Z';

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

test('hjorth-complexity: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenHjorthComplexity([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 24);
  assert.equal(r.sort, 'complexity-asc');
  assert.equal(r.generatedAt, GEN);
});

test('hjorth-complexity: constant series dropped under zero-variance', () => {
  const v = Array.from({ length: 64 }, () => 7);
  const r = buildSourceRowTokenHjorthComplexity(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.droppedFlatDiff, 0);
});

test('hjorth-complexity: perfect linear ramp dropped under flat-diff', () => {
  // dv constant => var(dv) = 0 => complexity 0/0 undefined.
  const v = Array.from({ length: 64 }, (_, i) => i);
  const r = buildSourceRowTokenHjorthComplexity(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 0);
  assert.equal(r.droppedFlatDiff, 1);
});

test('hjorth-complexity: pure sinusoid -> complexity ~ 1', () => {
  // For v[i] = A sin(w i), dv ~ A w cos(w i + w/2), ddv ~ -A w^2 sin(...).
  // mobility(v) ~ 2 sin(w/2). mobility(dv) ~ 2 sin(w/2). complexity ~ 1.
  const v = Array.from({ length: 256 }, (_, i) => 100 * Math.sin(i * 0.3));
  const r = buildSourceRowTokenHjorthComplexity(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const c = r.sources[0]!.complexity;
  // Discrete-time sinusoid mobility ratio is sin(w) / sin(w/2) =
  // 2 cos(w/2) for the cos-vs-sin pair; complexity = sin(w)/(2 sin(w/2))
  // / 1 ~ cos(w/2). For w=0.3, cos(0.15) ~ 0.989. Empirical sample
  // estimates run a bit higher because var(ddv) uses N-2 samples vs.
  // var(v) using N. Relax tolerance accordingly.
  assert.ok(
    c > 0.9 && c < 1.3,
    `sinusoid complexity=${c} should be in (0.9, 1.3)`,
  );
});

test('hjorth-complexity: white-noise-like series -> complexity ~ 1 (slightly above)', () => {
  // LCG-generated pseudo-noise. var(v) ~ var(dv)/2 ~ var(ddv)/6 in expectation
  // for ideal white noise; mobility(v) ~ sqrt(2), mobility(dv) ~ sqrt(3),
  // complexity ~ sqrt(3/2) ~ 1.225.
  let s = 12345 >>> 0;
  function next() {
    s = (s * 1103515245 + 12345) >>> 0;
    return ((s >>> 16) & 0xffff) / 0xffff - 0.5;
  }
  const v = Array.from({ length: 4096 }, () => next() * 100 + 1000);
  const r = buildSourceRowTokenHjorthComplexity(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const c = r.sources[0]!.complexity;
  // Theoretical expectation sqrt(3/2) ~ 1.2247; allow generous slack.
  assert.ok(
    Math.abs(c - Math.sqrt(1.5)) < 0.1,
    `white-noise complexity=${c} should be ~sqrt(1.5)~1.225`,
  );
});

test('hjorth-complexity: alternating 0/100 -> complexity ~ 1 (highly oscillatory)', () => {
  // For a perfect alternation v = [0, A, 0, A, ...], dv = [+A, -A, +A, ...]
  // and ddv = [-2A, +2A, -2A, ...]. var(v) = A^2/4, var(dv) = A^2,
  // var(ddv) = 4 A^2. mobility = sqrt(4) = 2; mobility(dv) = sqrt(4) = 2;
  // complexity = 1.
  const v = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 0 : 100));
  const r = buildSourceRowTokenHjorthComplexity(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const c = r.sources[0]!.complexity;
  // Asymptotically 1 exactly; finite-N has a tiny correction from the
  // population-variance denominator difference (N vs N-1 vs N-2).
  assert.ok(Math.abs(c - 1) < 1e-2, `alternation complexity=${c} should be ~1`);
  assert.ok(
    Math.abs(r.sources[0]!.mobility - 2) < 1e-2,
    `alternation mobility should be ~2 (got ${r.sources[0]!.mobility})`,
  );
});

test('hjorth-complexity: minRows gate drops short series', () => {
  const v = Array.from({ length: 12 }, (_, i) => i * 3 + (i % 5));
  const r = buildSourceRowTokenHjorthComplexity(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('hjorth-complexity: minRows must be integer >= 6', () => {
  assert.throws(
    () => buildSourceRowTokenHjorthComplexity([], { minRows: 5 }),
    /minRows must be an integer >= 6/,
  );
  assert.throws(
    () => buildSourceRowTokenHjorthComplexity([], { minRows: 6.5 }),
    /minRows must be an integer >= 6/,
  );
});

test('hjorth-complexity: scale-invariance — multiplying by a constant does not change complexity', () => {
  let s = 7777 >>> 0;
  function next() {
    s = (s * 1103515245 + 12345) >>> 0;
    return ((s >>> 16) & 0xffff) / 0xffff;
  }
  const base = Array.from({ length: 256 }, () => next() * 50 + 10);
  const scaled = base.map((x) => x * 1000);
  const a = buildSourceRowTokenHjorthComplexity(series(base), {
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenHjorthComplexity(series(scaled), {
    generatedAt: GEN,
  });
  assert.equal(a.sources.length, 1);
  assert.equal(b.sources.length, 1);
  assert.ok(
    Math.abs(a.sources[0]!.complexity - b.sources[0]!.complexity) < 1e-9,
    `complexity should be scale-invariant: ${a.sources[0]!.complexity} vs ${b.sources[0]!.complexity}`,
  );
});

test('hjorth-complexity: shift-invariance — adding a moderate constant does not change complexity', () => {
  // Mathematically shift-invariant. Numerically, a *huge* DC offset
  // would cause catastrophic cancellation in the naive sum-of-squared-
  // deviations variance; here we use a moderate shift comparable to
  // the signal amplitude, which is the realistic case for token counts.
  // Base must be all-positive (the lens drops negative total_tokens).
  const base = Array.from(
    { length: 64 },
    (_, i) => Math.sin(i * 0.4) * 20 + 50,
  );
  const shifted = base.map((x) => x + 100);
  const a = buildSourceRowTokenHjorthComplexity(series(base), {
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenHjorthComplexity(series(shifted), {
    generatedAt: GEN,
  });
  const ca = a.sources[0]!.complexity;
  const cb = b.sources[0]!.complexity;
  assert.equal(a.sources[0]!.rowsKept, b.sources[0]!.rowsKept);
  assert.ok(
    Math.abs(ca - cb) < 1e-9,
    `shift-invariance: ${ca} vs ${cb}`,
  );
});

test('hjorth-complexity: sort variants and tiebreak', () => {
  // Two distinct sources with different complexity profiles.
  // s_a: alternation -> complexity = 1.
  // s_b: noise -> complexity > 1.
  const a = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 0 : 100));
  let s = 4242 >>> 0;
  function next() {
    s = (s * 1103515245 + 12345) >>> 0;
    return ((s >>> 16) & 0xffff) / 0xffff;
  }
  const b = Array.from({ length: 64 }, () => next() * 100);
  const queue: QueueLine[] = [...series(a, 's_a'), ...series(b, 's_b')];
  const asc = buildSourceRowTokenHjorthComplexity(queue, {
    generatedAt: GEN,
    minRows: 24,
  });
  assert.equal(asc.sources.length, 2);
  // s_a (complexity ~ 1) should sort first.
  assert.equal(asc.sources[0]!.source, 's_a');
  const desc = buildSourceRowTokenHjorthComplexity(queue, {
    generatedAt: GEN,
    minRows: 24,
    sort: 'complexity-desc',
  });
  assert.equal(desc.sources[0]!.source, 's_b');
  const bySource = buildSourceRowTokenHjorthComplexity(queue, {
    generatedAt: GEN,
    minRows: 24,
    sort: 'source',
  });
  assert.equal(bySource.sources[0]!.source, 's_a');
});

test('hjorth-complexity: top cap surfaces droppedBelowTopCap', () => {
  let s = 999 >>> 0;
  function next() {
    s = (s * 1103515245 + 12345) >>> 0;
    return ((s >>> 16) & 0xffff) / 0xffff;
  }
  const queue: QueueLine[] = [];
  for (let k = 0; k < 5; k++) {
    const arr = Array.from({ length: 32 }, () => next() * 10);
    queue.push(...series(arr, `s_${k}`));
  }
  const r = buildSourceRowTokenHjorthComplexity(queue, {
    generatedAt: GEN,
    minRows: 24,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 3);
});

test('hjorth-complexity: source filter restricts to one source', () => {
  const a = Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? 0 : 50));
  const b = Array.from({ length: 32 }, (_, i) => i);
  const queue: QueueLine[] = [...series(a, 'keep'), ...series(b, 'drop')];
  const r = buildSourceRowTokenHjorthComplexity(queue, {
    generatedAt: GEN,
    source: 'keep',
  });
  assert.equal(r.source, 'keep');
  assert.equal(r.droppedSourceFilter, 32);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
});

test('hjorth-complexity: invalid total_tokens / hour_start counted', () => {
  const queue: QueueLine[] = [];
  queue.push(ql('not-a-date', 's', 100));
  queue.push(ql('2026-04-25T00:00:00Z', 's', Number.NaN));
  queue.push(ql('2026-04-25T00:01:00Z', 's', -5));
  for (const q of series(
    Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? 0 : 99)),
  )) {
    queue.push(q);
  }
  const r = buildSourceRowTokenHjorthComplexity(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
});

test('hjorth-complexity: window since/until clipping', () => {
  const v = Array.from({ length: 200 }, (_, i) => (i % 3 === 0 ? 0 : 50));
  const r = buildSourceRowTokenHjorthComplexity(series(v), {
    generatedAt: GEN,
    since: '2026-04-25T01:00:00Z',
    until: '2026-04-25T02:00:00Z',
  });
  // Exactly 60 rows in that 1-hour window => >= minRows 24 => 1 source.
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 60);
});

test('hjorth-complexity: complexity report includes mobility and mobilityDv components', () => {
  const v = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 0 : 80));
  const r = buildSourceRowTokenHjorthComplexity(series(v), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(row.mobility > 0);
  assert.ok(row.mobilityDv > 0);
  // complexity == mobilityDv / mobility by definition.
  assert.ok(
    Math.abs(row.complexity - row.mobilityDv / row.mobility) < 1e-12,
  );
});

test('hjorth-complexity: minComplexity defaults to null; report flag round-trips', () => {
  const r = buildSourceRowTokenHjorthComplexity([], { generatedAt: GEN });
  assert.equal(r.minComplexity, null);
  assert.equal(r.droppedBelowMinComplexity, 0);
  const r2 = buildSourceRowTokenHjorthComplexity([], {
    generatedAt: GEN,
    minComplexity: 1.5,
  });
  assert.equal(r2.minComplexity, 1.5);
});

test('hjorth-complexity: minComplexity must be non-negative finite number', () => {
  assert.throws(
    () =>
      buildSourceRowTokenHjorthComplexity([], { minComplexity: -0.1 }),
    /minComplexity must be a non-negative finite number/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenHjorthComplexity([], {
        minComplexity: Number.POSITIVE_INFINITY,
      }),
    /minComplexity must be a non-negative finite number/,
  );
});

test('hjorth-complexity: minComplexity suppresses sinusoidal-tail and surfaces noisy outliers', () => {
  // Two sources: s_sine (alternation -> complexity ~ 1) and
  // s_noise (LCG noise -> complexity > 1.2). With --min-complexity 1.1,
  // s_sine is suppressed under droppedBelowMinComplexity.
  const sine = Array.from({ length: 64 }, (_, i) =>
    i % 2 === 0 ? 0 : 100,
  );
  let s = 314159 >>> 0;
  function next() {
    s = (s * 1103515245 + 12345) >>> 0;
    return ((s >>> 16) & 0xffff) / 0xffff;
  }
  const noise = Array.from({ length: 1024 }, () => next() * 100 + 1000);
  const queue: QueueLine[] = [
    ...series(sine, 's_sine'),
    ...series(noise, 's_noise'),
  ];
  const unfiltered = buildSourceRowTokenHjorthComplexity(queue, {
    generatedAt: GEN,
  });
  assert.equal(unfiltered.sources.length, 2);
  assert.equal(unfiltered.droppedBelowMinComplexity, 0);
  const filtered = buildSourceRowTokenHjorthComplexity(queue, {
    generatedAt: GEN,
    minComplexity: 1.1,
  });
  assert.equal(filtered.sources.length, 1);
  assert.equal(filtered.sources[0]!.source, 's_noise');
  assert.equal(filtered.droppedBelowMinComplexity, 1);
});

test('hjorth-complexity: minComplexity 0 keeps everything (lower-inclusive boundary)', () => {
  // The filter is strict (`< minComplexity`), so 0 keeps every
  // source whose complexity is >= 0 (i.e. every computed source).
  const v = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 0 : 80));
  const r = buildSourceRowTokenHjorthComplexity(series(v), {
    generatedAt: GEN,
    minComplexity: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowMinComplexity, 0);
});

test('hjorth-complexity: minComplexity applied AFTER honest drops (zero-variance still surfaces under its own counter)', () => {
  // A constant series should drop under zero-variance, NOT be silently
  // absorbed by the min-complexity filter.
  const v = Array.from({ length: 64 }, () => 42);
  const r = buildSourceRowTokenHjorthComplexity(series(v), {
    generatedAt: GEN,
    minComplexity: 100,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.droppedBelowMinComplexity, 0);
  assert.equal(r.sources.length, 0);
});
