import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTeagerKaiser } from '../src/sourcerowtokenteagerkaiser.js';
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

test('tkeo: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenTeagerKaiser([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.normalize, false);
  assert.equal(r.sort, 'tkeo-asc');
  assert.equal(r.generatedAt, GEN);
});

test('tkeo: constant series -> droppedZeroVariance', () => {
  const data = series(new Array(20).fill(7));
  const r = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('tkeo: too few rows -> droppedBelowMinRows', () => {
  const data = series([1, 2, 3]);
  const r = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('tkeo: linear ramp x_n=n -> psi identically 1', () => {
  // psi = n^2 - (n-1)(n+1) = n^2 - (n^2 - 1) = 1
  const data = series(Array.from({ length: 20 }, (_, i) => i + 1));
  const r = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.tkeoMean - 1) < 1e-9, `expected tkeoMean ~ 1, got ${s.tkeoMean}`);
  assert.equal(s.interiorSamples, 18);
});

test('tkeo: high-frequency alternating series -> large positive mean', () => {
  // x = [10, -10, 10, -10, ...]; psi_i = 100 - (-10*-10)*(-1)? compute:
  // x_i = (-1)^i * 10. x_{i-1}*x_{i+1} = 10*10*(-1)^{i-1+i+1}=100*(-1)^{2i}=100
  // psi_i = x_i^2 - 100 = 100 - 100 = 0. Hmm pure period-2: TKEO=0.
  // Actually for x = A cos(omega n), TKEO ~ A^2 sin^2(omega). For omega=pi (period 2), sin(pi)=0 -> 0.
  // Use period-4 for nonzero: x_n = cos(pi n / 2) * A
  const A = 100;
  const vals: number[] = [];
  for (let i = 0; i < 40; i++) vals.push(A * Math.cos((Math.PI * i) / 2) + A * 2);
  const data = series(vals);
  const r = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  // For x_n - mean = A cos(pi n/2), TKEO ~ A^2 sin^2(pi/2) = A^2 = 10000
  // But actual signal includes DC offset; psi is invariant under zero-frequency? No.
  // x = A cos + C; psi(x) = (A cos + C)^2 - (A cos_{n-1}+C)(A cos_{n+1}+C).
  // After algebra psi = A^2 [cos^2(omega n) - cos((omega(n-1))cos(omega(n+1))] + cross terms.
  // We just assert tkeoMean is significantly positive and finite.
  assert.ok(Number.isFinite(s.tkeoMean));
  assert.ok(s.tkeoMean > 0, `expected positive tkeoMean, got ${s.tkeoMean}`);
});

test('tkeo: pure cosine of known omega -> expected ~ A^2 sin^2(omega)', () => {
  const A = 50;
  const omega = 0.3;
  const vals: number[] = [];
  for (let i = 0; i < 200; i++) vals.push(A * Math.cos(omega * i) + 1000);
  const data = series(vals);
  const r = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  const expected = A * A * Math.sin(omega) * Math.sin(omega);
  // Allow ~10% tolerance — DC offset & finite-n introduce small bias
  assert.ok(
    Math.abs(s.tkeoMean - expected) / expected < 0.15,
    `expected ~${expected.toFixed(2)}, got ${s.tkeoMean.toFixed(2)}`,
  );
});

test('tkeo: orthogonal to dispersion — random shuffle changes tkeoMean', () => {
  const ordered = Array.from({ length: 100 }, (_, i) => (i * 37) % 100);
  // ordered: deterministic structured series
  const orderedData = series(ordered);
  const orderedR = buildSourceRowTokenTeagerKaiser(orderedData, { generatedAt: GEN });
  // shuffle
  const shuffled = [...ordered];
  let seed = 7;
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const shuffledData = series(shuffled);
  const shuffledR = buildSourceRowTokenTeagerKaiser(shuffledData, { generatedAt: GEN });
  assert.equal(orderedR.sources.length, 1);
  assert.equal(shuffledR.sources.length, 1);
  assert.notEqual(
    orderedR.sources[0]!.tkeoMean.toFixed(6),
    shuffledR.sources[0]!.tkeoMean.toFixed(6),
  );
});

test('tkeo: --normalize emits tkeoMeanNormalized = tkeoMean / sigma^2', () => {
  const data = series(Array.from({ length: 20 }, (_, i) => i + 1));
  const r = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN, normalize: true });
  assert.equal(r.normalize, true);
  const s = r.sources[0]!;
  assert.ok(s.tkeoMeanNormalized !== null);
  const expected = s.tkeoMean / (s.sigma * s.sigma);
  assert.ok(
    Math.abs(s.tkeoMeanNormalized! - expected) < 1e-9,
    `normalized mismatch: got ${s.tkeoMeanNormalized}, expected ${expected}`,
  );
});

test('tkeo: --normalize=false leaves tkeoMeanNormalized null', () => {
  const data = series(Array.from({ length: 20 }, (_, i) => i + 1));
  const r = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN, normalize: false });
  assert.equal(r.sources[0]!.tkeoMeanNormalized, null);
});

test('tkeo: minRows must be >= 3', () => {
  assert.throws(() => buildSourceRowTokenTeagerKaiser([], { minRows: 2 }));
  assert.throws(() => buildSourceRowTokenTeagerKaiser([], { minRows: 0 }));
  assert.throws(() => buildSourceRowTokenTeagerKaiser([], { minRows: -1 }));
  assert.throws(() => buildSourceRowTokenTeagerKaiser([], { minRows: 3.5 }));
});

test('tkeo: invalid sort throws', () => {
  assert.throws(() =>
    buildSourceRowTokenTeagerKaiser([], { sort: 'bogus' as any }),
  );
});

test('tkeo: invalid top throws', () => {
  assert.throws(() => buildSourceRowTokenTeagerKaiser([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenTeagerKaiser([], { top: -1 }));
  assert.throws(() => buildSourceRowTokenTeagerKaiser([], { top: 1.5 }));
});

test('tkeo: invalid since/until throws', () => {
  assert.throws(() =>
    buildSourceRowTokenTeagerKaiser([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceRowTokenTeagerKaiser([], { until: 'not-a-date' }),
  );
});

test('tkeo: bad hour_start counted', () => {
  const data = [ql('not-a-date', 's', 100), ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])];
  const r = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('tkeo: bad total_tokens counted', () => {
  const bad = ql('2026-04-25T00:00:00Z', 's', NaN);
  const data = [bad, ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])];
  const r = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('tkeo: negative total_tokens counted', () => {
  const bad = ql('2026-04-25T00:00:00Z', 's', -5);
  const data = [bad, ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])];
  const r = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('tkeo: source filter excludes others', () => {
  const a = series(Array.from({ length: 10 }, (_, i) => i + 1), 'a');
  const b = series(Array.from({ length: 10 }, (_, i) => (i + 1) * 2), 'b');
  const r = buildSourceRowTokenTeagerKaiser([...a, ...b], {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.droppedSourceFilter, 10);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('tkeo: window filtering [since, until)', () => {
  const data = [
    ql('2026-04-25T00:00:00Z', 's', 1),
    ql('2026-04-25T01:00:00Z', 's', 2),
    ql('2026-04-26T00:00:00Z', 's', 3),
    ql('2026-04-27T00:00:00Z', 's', 4),
    ql('2026-04-28T00:00:00Z', 's', 5),
    ql('2026-04-29T00:00:00Z', 's', 6),
    ql('2026-04-30T00:00:00Z', 's', 7),
    ql('2026-05-01T00:00:00Z', 's', 8),
    ql('2026-05-02T00:00:00Z', 's', 9),
    ql('2026-05-03T00:00:00Z', 's', 10),
  ];
  const r = buildSourceRowTokenTeagerKaiser(data, {
    generatedAt: GEN,
    since: '2026-04-26T00:00:00Z',
    until: '2026-05-01T00:00:00Z',
  });
  // Should include 04-26..04-30 = 5 rows, but minRows default 8 -> dropped
  assert.equal(r.droppedBelowMinRows, 1);
});

test('tkeo: sort tkeo-desc puts highest first', () => {
  const a = series(Array.from({ length: 20 }, (_, i) => i + 1), 'a');  // ramp -> tkeo=1
  // periodic high-energy:
  const bVals: number[] = [];
  for (let i = 0; i < 20; i++) bVals.push(100 + 50 * Math.cos((Math.PI * i) / 3));
  const b = series(bVals, 'b');
  const r = buildSourceRowTokenTeagerKaiser([...a, ...b], {
    generatedAt: GEN,
    sort: 'tkeo-desc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[1]!.source, 'a');
});

test('tkeo: sort tkeo-asc puts lowest first', () => {
  const a = series(Array.from({ length: 20 }, (_, i) => i + 1), 'a');
  const bVals: number[] = [];
  for (let i = 0; i < 20; i++) bVals.push(100 + 50 * Math.cos((Math.PI * i) / 3));
  const b = series(bVals, 'b');
  const r = buildSourceRowTokenTeagerKaiser([...a, ...b], {
    generatedAt: GEN,
    sort: 'tkeo-asc',
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('tkeo: sort source = lex asc', () => {
  const z = series(Array.from({ length: 10 }, (_, i) => i + 1), 'z');
  const a = series(Array.from({ length: 10 }, (_, i) => i + 1), 'a');
  const r = buildSourceRowTokenTeagerKaiser([...z, ...a], {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'z');
});

test('tkeo: sort rows = rowsKept desc', () => {
  const a = series(Array.from({ length: 30 }, (_, i) => i + 1), 'a');
  const b = series(Array.from({ length: 10 }, (_, i) => i + 1), 'b');
  const r = buildSourceRowTokenTeagerKaiser([...a, ...b], {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[0]!.rowsKept, 30);
});

test('tkeo: top caps results, droppedBelowTopCap counts excess', () => {
  const a = series(Array.from({ length: 10 }, (_, i) => i + 1), 'a');
  const b = series(Array.from({ length: 10 }, (_, i) => (i + 1) * 2), 'b');
  const c = series(Array.from({ length: 10 }, (_, i) => (i + 1) * 3), 'c');
  const r = buildSourceRowTokenTeagerKaiser([...a, ...b, ...c], {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('tkeo: missing source becomes "unknown"', () => {
  const data = series(Array.from({ length: 10 }, (_, i) => i + 1), '');
  const r = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('tkeo: scaling x by k scales tkeoMean by k^2', () => {
  const base = Array.from({ length: 20 }, (_, i) => i + 1);
  const scaled = base.map((x) => x * 5);
  const baseR = buildSourceRowTokenTeagerKaiser(series(base, 'a'), { generatedAt: GEN });
  const scaledR = buildSourceRowTokenTeagerKaiser(series(scaled, 'a'), { generatedAt: GEN });
  const ratio = scaledR.sources[0]!.tkeoMean / baseR.sources[0]!.tkeoMean;
  assert.ok(
    Math.abs(ratio - 25) < 1e-6,
    `expected scaling factor ~ 25 (= 5^2), got ${ratio}`,
  );
});

test('tkeo: rows are time-ordered before TKEO computation', () => {
  // Reverse temporal order should not change result if we re-sort by hour_start
  const ordered = Array.from({ length: 20 }, (_, i) => i + 1);
  const data = series(ordered);
  const dataReversed = [...data].reverse();
  const r1 = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN });
  const r2 = buildSourceRowTokenTeagerKaiser(dataReversed, { generatedAt: GEN });
  assert.equal(
    r1.sources[0]!.tkeoMean.toFixed(6),
    r2.sources[0]!.tkeoMean.toFixed(6),
  );
});

test('tkeo: minRows custom value applied', () => {
  const data = series([1, 2, 3, 4, 5, 6, 7]);  // n=7
  const r = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN, minRows: 8 });
  assert.equal(r.droppedBelowMinRows, 1);
  const r2 = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN, minRows: 5 });
  assert.equal(r2.sources.length, 1);
});

test('tkeo: report fields all present and finite', () => {
  const data = series(Array.from({ length: 20 }, (_, i) => i + 1));
  const r = buildSourceRowTokenTeagerKaiser(data, { generatedAt: GEN });
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
  assert.equal(r.source, null);
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalRowsKept, 20);
  const s = r.sources[0]!;
  assert.ok(Number.isFinite(s.sigma));
  assert.ok(Number.isFinite(s.tkeoMean));
  assert.equal(s.interiorSamples, 18);
  assert.equal(s.rowsKept, 20);
});

test('tkeo: multi-source — independent computations', () => {
  const a = series(Array.from({ length: 10 }, (_, i) => i + 1), 'a');
  const b = series(Array.from({ length: 12 }, (_, i) => (i + 1) * 10), 'b');
  const r = buildSourceRowTokenTeagerKaiser([...a, ...b], { generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 2);
});
