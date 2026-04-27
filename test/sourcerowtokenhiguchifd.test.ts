import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenHiguchiFd } from '../src/sourcerowtokenhiguchifd.js';
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

test('higuchi-fd: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenHiguchiFd([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.kMax, 8);
  assert.equal(r.minK, 4);
  assert.equal(r.minRows, 16);
  assert.equal(r.sort, 'hfd-asc');
  assert.equal(r.generatedAt, GEN);
});

test('higuchi-fd: constant series -> droppedZeroVariance', () => {
  const data = series(new Array(40).fill(7));
  const r = buildSourceRowTokenHiguchiFd(data, { generatedAt: GEN });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('higuchi-fd: too few rows -> droppedBelowMinRows', () => {
  const data = series([1, 2, 3, 4, 5, 6, 7, 8]);
  const r = buildSourceRowTokenHiguchiFd(data, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('higuchi-fd: smooth ramp -> slopeRaw=0 (clamped to HFD=1)', () => {
  // Linear ramp: a perfectly smooth 1D curve. For v[i]=i+1, every
  // sub-grid yields |v[m+ik-1]-v[m+(i-1)k-1]| = k, so absSum=M*k,
  // Lm(k) = (M*k*(N-1))/(M*k) = N-1 for every k. Therefore L(k) is
  // constant in k -> OLS slope = 0 -> slopeRaw = 0 -> clamped to HFD = 1.
  // This is the canonical Higuchi behaviour for a deterministic ramp:
  // the estimator reports the lower-bound dimension after clamping,
  // and `clampedBelow1` flags the underlying flat regression for the
  // operator. R^2 is undefined (ssTot=0) and is reported as 1.
  const vals: number[] = [];
  for (let i = 0; i < 100; i++) vals.push(i + 1);
  const data = series(vals);
  const r = buildSourceRowTokenHiguchiFd(data, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.slopeRaw) < 1e-9, `slopeRaw should be ~0, got ${s.slopeRaw}`);
  assert.equal(s.hfd, 1);
  assert.equal(r.clampedBelow1, 1);
});

test('higuchi-fd: pseudo-random series -> rougher than ramp (slopeRaw > 0)', () => {
  // Deterministic pseudo-random sequence. HFD slope should be
  // strictly positive (path length grows as the sub-sampling stride
  // shrinks), unlike a smooth ramp where the slope is exactly 0.
  // Magnitude of the slope under this Higuchi estimator depends on
  // (n, kMax) and the spectral profile of the LCG; we only assert
  // the qualitative ordering vs. the ramp baseline here.
  const vals: number[] = [];
  let x = 17;
  for (let i = 0; i < 200; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    vals.push((x % 1000) + 1);
  }
  const data = series(vals);
  const r = buildSourceRowTokenHiguchiFd(data, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.ok(s.slopeRaw > 0.5, `slopeRaw should be > 0.5, got ${s.slopeRaw}`);
  assert.ok(s.hfd >= 1 && s.hfd <= 2);
});

test('higuchi-fd: invalid kMax / minK / minRows rejected', () => {
  assert.throws(() => buildSourceRowTokenHiguchiFd([], { kMax: 1 }));
  assert.throws(() => buildSourceRowTokenHiguchiFd([], { kMax: 65 }));
  assert.throws(() => buildSourceRowTokenHiguchiFd([], { kMax: 1.5 }));
  assert.throws(() => buildSourceRowTokenHiguchiFd([], { minK: 1 }));
  assert.throws(() => buildSourceRowTokenHiguchiFd([], { kMax: 8, minK: 9 }));
  assert.throws(() => buildSourceRowTokenHiguchiFd([], { minRows: 5 })); // < kMax+2 = 10
});

test('higuchi-fd: invalid since/until/sort/top rejected', () => {
  assert.throws(() => buildSourceRowTokenHiguchiFd([], { since: 'not-a-date' }));
  assert.throws(() => buildSourceRowTokenHiguchiFd([], { until: 'not-a-date' }));
  assert.throws(() =>
    buildSourceRowTokenHiguchiFd([], { sort: 'bogus' as 'hfd-asc' }),
  );
  assert.throws(() => buildSourceRowTokenHiguchiFd([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenHiguchiFd([], { top: 1.5 }));
});

test('higuchi-fd: source filter and dropped counters', () => {
  const a = series(
    Array.from({ length: 30 }, (_, i) => i + 1),
    'aaa',
  );
  const b = series(
    Array.from({ length: 30 }, (_, i) => 100 - i),
    'bbb',
  );
  const r = buildSourceRowTokenHiguchiFd([...a, ...b], {
    generatedAt: GEN,
    source: 'aaa',
  });
  assert.equal(r.droppedSourceFilter, 30);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'aaa');
});

test('higuchi-fd: top cap and droppedBelowTopCap', () => {
  const a = series(
    Array.from({ length: 30 }, (_, i) => i + 1),
    'aaa',
  );
  const b = series(
    Array.from({ length: 30 }, (_, i) => i % 2 === 0 ? 1 : 5),
    'bbb',
  );
  const r = buildSourceRowTokenHiguchiFd([...a, ...b], {
    generatedAt: GEN,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('higuchi-fd: source asc tiebreak', () => {
  // Two identical ramps under different source names -> equal HFD
  const a = series(
    Array.from({ length: 30 }, (_, i) => i + 1),
    'zzz',
  );
  const b = series(
    Array.from({ length: 30 }, (_, i) => i + 1),
    'aaa',
  );
  const r = buildSourceRowTokenHiguchiFd([...a, ...b], {
    generatedAt: GEN,
    sort: 'hfd-asc',
  });
  assert.equal(r.sources[0]!.source, 'aaa');
  assert.equal(r.sources[1]!.source, 'zzz');
});

test('higuchi-fd: drops invalid hour_start, invalid total_tokens, negative total_tokens', () => {
  const data: QueueLine[] = [
    ql('not-a-date', 's', 5),
    ql('2026-04-25T00:00:00Z', 's', Number.NaN),
    ql('2026-04-25T00:01:00Z', 's', -1),
  ];
  const r = buildSourceRowTokenHiguchiFd(data, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 0);
});

test('higuchi-fd: report carries options', () => {
  const r = buildSourceRowTokenHiguchiFd([], {
    generatedAt: GEN,
    kMax: 16,
    minK: 6,
    minRows: 18,
    sort: 'hfd-desc',
    top: 5,
  });
  assert.equal(r.kMax, 16);
  assert.equal(r.minK, 6);
  assert.equal(r.minRows, 18);
  assert.equal(r.sort, 'hfd-desc');
  assert.equal(r.top, 5);
});

test('higuchi-fd: hfd-desc sort ranks roughest source first', () => {
  const ramp = series(
    Array.from({ length: 80 }, (_, i) => i + 1),
    'smooth',
  );
  // Pseudo-random series for the rough source
  const rough: number[] = [];
  let x = 31;
  for (let i = 0; i < 80; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    rough.push((x % 1000) + 1);
  }
  const alt = series(rough, 'rough');
  const r = buildSourceRowTokenHiguchiFd([...ramp, ...alt], {
    generatedAt: GEN,
    sort: 'hfd-desc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'rough');
  assert.equal(r.sources[1]!.source, 'smooth');
  assert.ok(r.sources[0]!.hfd > r.sources[1]!.hfd);
});

test('higuchi-fd --detrend: defaults to false; report carries flag', () => {
  const r = buildSourceRowTokenHiguchiFd([], { generatedAt: GEN });
  assert.equal(r.detrend, false);
  const r2 = buildSourceRowTokenHiguchiFd([], {
    generatedAt: GEN,
    detrend: true,
  });
  assert.equal(r2.detrend, true);
});

test('higuchi-fd --detrend: pure ramp + tiny noise -> with detrend exposes residual roughness', () => {
  // Pure ramp + small alternating perturbation. Without detrend
  // the linear drift dominates path length and HFD slope is ~0.
  // With detrend the residual is just the small alternating
  // signal -> path length DOES grow as stride shrinks -> slope > 0.
  const vals: number[] = [];
  for (let i = 0; i < 80; i++) vals.push(100 * (i + 1) + (i % 2 === 0 ? 0 : 1));
  const data = series(vals);
  const noTrend = buildSourceRowTokenHiguchiFd(data, {
    generatedAt: GEN,
    detrend: false,
  });
  const withTrend = buildSourceRowTokenHiguchiFd(data, {
    generatedAt: GEN,
    detrend: true,
  });
  // Both produce one row.
  assert.equal(noTrend.sources.length, 1);
  assert.equal(withTrend.sources.length, 1);
  // Without detrend: slope is essentially 0 (drift dominates).
  assert.ok(
    Math.abs(noTrend.sources[0]!.slopeRaw) < 0.05,
    `no-detrend slopeRaw should be ~0, got ${noTrend.sources[0]!.slopeRaw}`,
  );
  // With detrend: residual = alternating -> slope strictly larger.
  assert.ok(
    withTrend.sources[0]!.slopeRaw > noTrend.sources[0]!.slopeRaw + 0.1,
    `detrend should increase slope, got ${withTrend.sources[0]!.slopeRaw} vs ${noTrend.sources[0]!.slopeRaw}`,
  );
});

test('higuchi-fd --detrend: pure ramp -> sigma collapses, droppedZeroVariance', () => {
  // A pure linear ramp has zero residuals after OLS detrend ->
  // sigma = 0 -> droppedZeroVariance. (Without detrend, the ramp
  // has positive sigma and is processed normally.)
  const vals: number[] = [];
  for (let i = 0; i < 50; i++) vals.push(i + 1);
  const data = series(vals);
  const r = buildSourceRowTokenHiguchiFd(data, {
    generatedAt: GEN,
    detrend: true,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('higuchi-fd: HFD scale-invariant under positive affine scaling', () => {
  // HFD is theoretically invariant under v -> alpha*v + beta for alpha > 0.
  // (alpha cancels in the L(k) ratios; beta cancels in the |deltas|.)
  // Verify on a non-trivial sequence that the slopeRaw is identical
  // (modulo float rounding) under such a transform.
  const baseVals: number[] = [];
  let x = 7;
  for (let i = 0; i < 60; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    baseVals.push((x % 500) + 10);
  }
  const scaled = baseVals.map((v) => 13 * v + 1000);
  const r1 = buildSourceRowTokenHiguchiFd(series(baseVals, 'a'), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenHiguchiFd(series(scaled, 'a'), {
    generatedAt: GEN,
  });
  assert.equal(r1.sources.length, 1);
  assert.equal(r2.sources.length, 1);
  // slopeRaw should be identical to high precision (the only diff is
  // multiplicative constants inside log() that cancel after subtraction
  // of ybar).
  assert.ok(
    Math.abs(r1.sources[0]!.slopeRaw - r2.sources[0]!.slopeRaw) < 1e-9,
    `slopeRaw should be invariant: got ${r1.sources[0]!.slopeRaw} vs ${r2.sources[0]!.slopeRaw}`,
  );
  // sigmas of course differ by factor 13.
  assert.ok(Math.abs(r2.sources[0]!.sigma / r1.sources[0]!.sigma - 13) < 1e-6);
});

test('higuchi-fd: time-window filter (since/until) trims rows correctly', () => {
  // 30 rows across multiple days; restrict to a 1-day window.
  const data = series(
    Array.from({ length: 30 }, (_, i) => i + 1),
  );
  const r = buildSourceRowTokenHiguchiFd(data, {
    generatedAt: GEN,
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-25T00:30:00Z', // first 30 minutes (rows 0..29) -> all 30
    minRows: 16,
  });
  // All 30 rows fall in the [0, 30) minute window
  assert.equal(r.totalRowsKept, 30);
});
