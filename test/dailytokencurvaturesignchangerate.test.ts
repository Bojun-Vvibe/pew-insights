import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyTokenCurvatureSignChangeRate,
  curvatureSignChangeRate,
} from '../src/dailytokencurvaturesignchangerate.js';
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

// ---- curvatureSignChangeRate primitive ------------------------------

test('curvatureSignChangeRate: rejects non-finite values', () => {
  assert.throws(() => curvatureSignChangeRate([1, 2, NaN, 4, 5]));
  assert.throws(() => curvatureSignChangeRate([Infinity, 1, 2, 3, 4]));
});

test('curvatureSignChangeRate: rejects too-short series (n < 5)', () => {
  assert.throws(() => curvatureSignChangeRate([]));
  assert.throws(() => curvatureSignChangeRate([1, 2, 3]));
  assert.throws(() => curvatureSignChangeRate([1, 2, 3, 4]));
});

test('curvatureSignChangeRate: rejects zero variance (constant series)', () => {
  assert.throws(() => curvatureSignChangeRate([7, 7, 7, 7, 7, 7]));
});

test('curvatureSignChangeRate: pure linear ramp has d2=0 -> rejected', () => {
  // y[i] = 3*i + 1 -> d2 identically 0 -> still varies in y so
  // the variance guard does NOT fire, but every d2*d2 product is
  // 0 (not strictly < 0) so cscRate = 0.
  const v = [1, 4, 7, 10, 13, 16, 19];
  const r = curvatureSignChangeRate(v);
  assert.equal(r.cscRate, 0);
  assert.equal(r.signChanges, 0);
});

test('curvatureSignChangeRate: pure parabola y=n^2 -> d2 const -> cscRate=0', () => {
  // y[i] = i^2 -> d2[i] = 2 (constant) -> no sign change.
  const v = [0, 1, 4, 9, 16, 25, 36, 49];
  const r = curvatureSignChangeRate(v);
  assert.equal(r.cscRate, 0);
});

test('curvatureSignChangeRate: pure cubic y=n^3 -> d2 strictly increasing -> cscRate=0 once it passes through zero only once', () => {
  // d2[i] = (i+1)^3 - 2*i^3 + (i-1)^3 = 6*i (centered grid).
  // On i = 1..N-2 this is monotone positive, so no sign changes
  // when starting at i=0 with non-negative range. Pick a window
  // crossing zero.
  const v = [-27, -8, -1, 0, 1, 8, 27, 64];
  // d2[i] = 6 * (centred i) -- here centred indices are -2,-1,0,1,2,3.
  // d2 values: -12, -6, 0, 6, 12, 18 -> sign changes:
  //   (-12,-6): same -> no
  //   (-6,0):   product 0 -> no
  //   (0,6):    product 0 -> no
  //   (6,12), (12,18): same -> no
  // Total 0.
  const r = curvatureSignChangeRate(v);
  assert.equal(r.signChanges, 0);
});

test('curvatureSignChangeRate: alternating series gives high CSC', () => {
  // y = [0, 10, 0, 10, 0, 10, 0, 10] -> d2 = [-20, 20, -20, 20, -20, 20]
  // Adjacent products all negative -> all comparable pairs are sign changes.
  const v = [0, 10, 0, 10, 0, 10, 0, 10];
  const r = curvatureSignChangeRate(v);
  assert.equal(r.comparablePairs, v.length - 3); // 5
  assert.equal(r.signChanges, r.comparablePairs);
  assert.equal(r.cscRate, 1);
});

test('curvatureSignChangeRate: shift-invariant', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = curvatureSignChangeRate(v);
  const b = curvatureSignChangeRate(v.map((x) => x + 17));
  assert.equal(a.signChanges, b.signChanges);
  assert.equal(a.cscRate, b.cscRate);
});

test('curvatureSignChangeRate: linear-trend-invariant (d2 of linear part is 0)', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = curvatureSignChangeRate(v);
  const b = curvatureSignChangeRate(v.map((x, i) => x + 7 * i + 11));
  assert.equal(
    a.signChanges,
    b.signChanges,
    `linear trend should not change sign-changes: ${a.signChanges} vs ${b.signChanges}`,
  );
});

test('curvatureSignChangeRate: scale-invariant for k > 0', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = curvatureSignChangeRate(v).cscRate;
  const b = curvatureSignChangeRate(v.map((x) => 17 * x)).cscRate;
  assert.equal(a, b);
});

test('curvatureSignChangeRate: sign-flip-invariant', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = curvatureSignChangeRate(v).cscRate;
  // Need to add a constant to keep variance positive after negation.
  const b = curvatureSignChangeRate(v.map((x) => -x + 100)).cscRate;
  assert.equal(a, b);
});

test('curvatureSignChangeRate: time-reversal-invariant', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const a = curvatureSignChangeRate(v).cscRate;
  const b = curvatureSignChangeRate([...v].reverse()).cscRate;
  assert.equal(a, b);
});

test('curvatureSignChangeRate: cscNormalized = cscRate / (2/3)', () => {
  const v = [0, 10, 0, 10, 0, 10, 0, 10];
  const r = curvatureSignChangeRate(v);
  assert.ok(Math.abs(r.cscNormalized - r.cscRate * 1.5) < 1e-12);
});

test('curvatureSignChangeRate: cscRate in [0,1] for a long random-ish series', () => {
  const v = [1, 5, 2, 8, 3, 7, 4, 6, 9, 0, 11, 2, 5, 8, 3];
  const r = curvatureSignChangeRate(v);
  assert.ok(r.cscRate >= 0 && r.cscRate <= 1, `cscRate=${r.cscRate}`);
});

test('curvatureSignChangeRate: zero entries in d2 break runs without contributing', () => {
  // Construct y so that some d2 entries are exactly 0 (linear segment
  // sandwiched between two non-linear segments).
  const v = [0, 5, 10, 15, 20, 30, 25, 20, 15, 10];
  // d2[i] for i=1..8: 0,0,0,5,-15,0,0,0
  // adjacent pairs: (0,0)(0,0)(0,5)(5,-15)(-15,0)(0,0)(0,0)
  // Only (5,-15) is a strict sign change.
  const r = curvatureSignChangeRate(v);
  assert.equal(r.signChanges, 1);
});

test('curvatureSignChangeRate: orthogonality vs Petrosian (PFD ~ d1 sign changes)', () => {
  // Smooth monotone increasing with curvature reversals: d1 always
  // positive (PFD = 0), but d2 changes sign.
  const v = [0, 1, 3, 4, 7, 8, 12, 13];
  // d1: 1,2,1,3,1,4,1 -> all positive, PFD-like = 0
  // d2 of original: i=1..6 -> [2,-1,2,-2,3,-3]
  // adjacent products of d2: 2*-1<0, -1*2<0, 2*-2<0, -2*3<0, 3*-3<0
  // All 5 pairs flip. cscRate = 1.
  const r = curvatureSignChangeRate(v);
  assert.equal(r.cscRate, 1);
});

test('curvatureSignChangeRate: triangular wave -> d2 mostly zero (zeros break runs)', () => {
  // Triangular wave with period 4: y = [0,1,2,1,0,1,2,1,...]
  // d2 = [0, -2, 0, 2, 0, -2, ...] -- adjacent products are all 0
  // because every other entry is 0 (zeros never count as sign changes).
  const v = [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1];
  const r = curvatureSignChangeRate(v);
  assert.equal(r.cscRate, 0);
});

test('curvatureSignChangeRate: length-5 series produces 2 comparable pairs', () => {
  const v = [1, 5, 2, 8, 3];
  const r = curvatureSignChangeRate(v);
  assert.equal(r.comparablePairs, 2);
});

test('curvatureSignChangeRate: noisy series produces a non-trivial cscRate in (0,1)', () => {
  // Mixed-frequency series; just check the rate is bounded and non-degenerate.
  const v: number[] = new Array(400);
  for (let i = 0; i < v.length; i += 1) {
    v[i] =
      Math.sin(i * 0.37) +
      0.5 * Math.sin(i * 1.93) +
      0.25 * Math.sin(i * 5.11);
  }
  const r = curvatureSignChangeRate(v);
  assert.ok(r.cscRate > 0 && r.cscRate < 1, `cscRate=${r.cscRate}`);
});

// ---- buildDailyTokenCurvatureSignChangeRate -------------------------

test('build: rejects bad option types', () => {
  assert.throws(() =>
    buildDailyTokenCurvatureSignChangeRate([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenCurvatureSignChangeRate([], { minTenureDays: 4 }),
  );
  assert.throws(() =>
    buildDailyTokenCurvatureSignChangeRate([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenCurvatureSignChangeRate([], {
      sort: 'bogus' as unknown as 'cscRate',
    }),
  );
});

test('build: empty queue -> empty report', () => {
  const r = buildDailyTokenCurvatureSignChangeRate([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('build: single source produces one row with expected fields', () => {
  // 12 active days; alternating heavy/light pattern -> non-trivial CSC.
  const v = [1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000];
  const q = buildSeries(v, 'src-a');
  const r = buildDailyTokenCurvatureSignChangeRate(q, {
    generatedAt: GEN,
    minTenureDays: 5,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'src-a');
  assert.equal(s.nTenureDays, 12);
  assert.equal(s.comparablePairs, 9);
  assert.ok(s.cscRate >= 0 && s.cscRate <= 1);
});

test('build: respects min-tenure-days filter', () => {
  const q = buildSeries([100, 200, 300, 400, 500], 'src-short');
  const r = buildDailyTokenCurvatureSignChangeRate(q, {
    generatedAt: GEN,
    minTenureDays: 32,
    minTokens: 0,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('build: respects min-tokens filter', () => {
  const v: number[] = new Array(40).fill(0).map((_, i) => (i % 2 === 0 ? 5 : 10));
  const q = buildSeries(v, 'tiny');
  const r = buildDailyTokenCurvatureSignChangeRate(q, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('build: source filter', () => {
  const a = buildSeries([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000], 'src-a');
  const b = buildSeries([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000], 'src-b');
  const r = buildDailyTokenCurvatureSignChangeRate([...a, ...b], {
    generatedAt: GEN,
    source: 'src-a',
    minTenureDays: 5,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: gap-fill produces zeros for missing days', () => {
  // active on day 0 and day 10 only -> tenure = 11; 9 zero-fill days.
  const q = [
    row('2024-01-01', 'gappy', 5000),
    row('2024-01-11', 'gappy', 5000),
  ];
  const r = buildDailyTokenCurvatureSignChangeRate(q, {
    generatedAt: GEN,
    minTenureDays: 5,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 11);
  assert.equal(r.sources[0]!.nActiveDays, 2);
});

test('build: drops constant gap-filled series', () => {
  // Single active day -> tenure 1 -> below min-tenure-days first.
  // Use multiple identical days -> all same value -> zero variance.
  const q: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    const ms = Date.parse('2024-01-01T00:00:00.000Z') + i * 86_400_000;
    const day = new Date(ms).toISOString().slice(0, 10);
    q.push(row(day, 'flat', 1000));
  }
  const r = buildDailyTokenCurvatureSignChangeRate(q, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: top cap surfaces droppedTopSources', () => {
  const queues: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    const v: number[] = new Array(40).fill(0).map((_, i) => 1000 + ((i + s) % 7) * 500);
    queues.push(...buildSeries(v, `src-${s}`));
  }
  const r = buildDailyTokenCurvatureSignChangeRate(queues, {
    generatedAt: GEN,
    top: 2,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('build: sort by source produces alphabetic order', () => {
  const queues: QueueLine[] = [
    ...buildSeries([1000, 2000, 1500, 3000, 2500, 4000, 3500, 5000], 'zeta'),
    ...buildSeries([1000, 2000, 1500, 3000, 2500, 4000, 3500, 5000], 'alpha'),
    ...buildSeries([1000, 2000, 1500, 3000, 2500, 4000, 3500, 5000], 'mid'),
  ];
  const r = buildDailyTokenCurvatureSignChangeRate(queues, {
    generatedAt: GEN,
    sort: 'source',
    minTenureDays: 5,
    minTokens: 0,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mid', 'zeta'],
  );
});

test('build: sort by cscRateDesc puts largest first', () => {
  // Extreme alternation source vs smoother source.
  const alt = [1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000];
  const smooth = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500];
  const queues = [
    ...buildSeries(alt, 'alt-src'),
    ...buildSeries(smooth, 'smooth-src'),
  ];
  const r = buildDailyTokenCurvatureSignChangeRate(queues, {
    generatedAt: GEN,
    sort: 'cscRateDesc',
    minTenureDays: 5,
    minTokens: 0,
  });
  assert.equal(r.sources[0]!.source, 'alt-src');
  assert.ok(r.sources[0]!.cscRate >= r.sources[1]!.cscRate);
});

test('build: invalid since/until rejected', () => {
  assert.throws(() =>
    buildDailyTokenCurvatureSignChangeRate([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildDailyTokenCurvatureSignChangeRate([], { until: 'not-a-date' }),
  );
});

test('build: invalid hour_start increments dropped counter', () => {
  const q: QueueLine[] = [
    { ...row('2024-01-01', 'src', 1000), hour_start: 'totally-broken' } as QueueLine,
    ...buildSeries([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000], 'src'),
  ];
  const r = buildDailyTokenCurvatureSignChangeRate(q, {
    generatedAt: GEN,
    minTenureDays: 5,
    minTokens: 0,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});
