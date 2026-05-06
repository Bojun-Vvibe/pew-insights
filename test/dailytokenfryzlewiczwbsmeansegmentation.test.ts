import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenFryzlewiczWbsMeanSegmentation,
  wildBinarySegmentation,
  mulberry32,
  median,
  mad,
  sigmaHatMadDiff,
} from '../src/dailytokenfryzlewiczwbsmeansegmentation.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, tokens: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

const GEN = '2026-05-06T12:00:00.000Z';

// ---- option validation ---------------------------------------------------

test('wbs: rejects bad minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], { minTenureDays: 20 }),
  );
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], { minTenureDays: 21.5 }),
  );
});

test('wbs: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], { minTokens: NaN }),
  );
});

test('wbs: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], { top: 1.5 }),
  );
});

test('wbs: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], {
      sort: 'nope' as 'mChangepoints',
    }),
  );
});

test('wbs: rejects bad cZeta / M / seed', () => {
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], { cZeta: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], { cZeta: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], { M: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], { M: 1.5 }),
  );
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], { seed: 1.5 }),
  );
});

test('wbs: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], { since: 'no' }),
  );
  assert.throws(() =>
    buildDailyTokenFryzlewiczWbsMeanSegmentation([], { until: 'no' }),
  );
});

// ---- pure helpers --------------------------------------------------------

test('mulberry32: deterministic and seedable', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 50; i += 1) assert.equal(a(), b());
  const c = mulberry32(43);
  // different seed should yield different first value
  assert.notEqual(mulberry32(42)(), c());
});

test('mulberry32: outputs in [0,1)', () => {
  const r = mulberry32(123);
  for (let i = 0; i < 1000; i += 1) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});

test('median: odd, even, empty', () => {
  assert.equal(median([]), 0);
  assert.equal(median([7]), 7);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test('mad: zero on constant, positive on spread', () => {
  assert.equal(mad([5, 5, 5, 5]), 0);
  assert.ok(mad([1, 2, 3, 4, 5]) > 0);
});

test('sigmaHatMadDiff: zero on constant, positive on iid noise', () => {
  assert.equal(sigmaHatMadDiff([10, 10, 10, 10, 10]), 0);
  // varying diffs => non-zero MAD-of-differences
  const noisy = [0, 1, 3, 2, 5, 4, 8, 6, 11, 9];
  assert.ok(sigmaHatMadDiff(noisy) > 0);
});

// ---- WBS core ------------------------------------------------------------

test('wildBinarySegmentation: throws on small/invalid input', () => {
  assert.throws(() => wildBinarySegmentation([1, 2, 3], 0, 10, 1));
  assert.throws(() => wildBinarySegmentation([1, 2, 3, 4], 0, 0, 1));
  assert.throws(() => wildBinarySegmentation([1, 2, 3, 4], 0, 1.5, 1));
  assert.throws(() => wildBinarySegmentation([1, 2, 3, 4], -1, 10, 1));
  assert.throws(() => wildBinarySegmentation([1, 2, 3, 4], 0, 10, 1.5));
});

test('wildBinarySegmentation: huge threshold => zero changepoints', () => {
  const x: number[] = [];
  for (let i = 0; i < 60; i += 1) x.push(i < 30 ? 0 : 100);
  const r = wildBinarySegmentation(x, 1e9, 50, 1);
  assert.equal(r.tauStar.length, 0);
  assert.equal(r.maxAbsCusum, 0);
});

test('wildBinarySegmentation: detects sharp single mean shift', () => {
  const x: number[] = [];
  for (let i = 0; i < 60; i += 1) x.push(i < 30 ? 0 : 100);
  const r = wildBinarySegmentation(x, 5, 100, 1);
  assert.ok(r.tauStar.length >= 1);
  // closest accepted CP should be near 30
  let nearest = Infinity;
  for (const t of r.tauStar) {
    const d = Math.abs(t - 30);
    if (d < nearest) nearest = d;
  }
  assert.ok(nearest <= 2, `nearest CP distance ${nearest}`);
});

test('wildBinarySegmentation: deterministic w.r.t. seed', () => {
  const x: number[] = [];
  for (let i = 0; i < 60; i += 1) x.push(i < 30 ? 0 : 100);
  const a = wildBinarySegmentation(x, 5, 50, 7);
  const b = wildBinarySegmentation(x, 5, 50, 7);
  assert.deepEqual(a.tauStar, b.tauStar);
  assert.equal(a.maxAbsCusum, b.maxAbsCusum);
});

test('wildBinarySegmentation: tauStar is strictly ascending', () => {
  const x: number[] = [];
  for (let i = 0; i < 90; i += 1) {
    if (i < 30) x.push(0);
    else if (i < 60) x.push(50);
    else x.push(100);
  }
  const r = wildBinarySegmentation(x, 3, 200, 1);
  for (let i = 1; i < r.tauStar.length; i += 1) {
    assert.ok(
      r.tauStar[i]! > r.tauStar[i - 1]!,
      `tauStar not ascending at ${i}: ${r.tauStar.join(',')}`,
    );
  }
});

// ---- builder integration -------------------------------------------------

function fillDays(
  start: string,
  vals: number[],
  src: string,
): QueueLine[] {
  const out: QueueLine[] = [];
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  for (let i = 0; i < vals.length; i += 1) {
    const day = new Date(startMs + i * 86_400_000).toISOString().slice(0, 10);
    if (vals[i]! > 0) out.push(ql(`${day}T12:00:00.000Z`, src, vals[i]!));
  }
  return out;
}

test('wbs: empty queue returns empty sources and zero rejections', () => {
  const r = buildDailyTokenFryzlewiczWbsMeanSegmentation([], {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.cZeta, 1.0);
  assert.equal(r.M, 200);
  assert.equal(r.seed, 0xc0ffee);
  assert.equal(r.sort, 'mChangepointsDesc');
});

test('wbs: detects mean shift on synthetic series', () => {
  // 30 days at ~1000, 30 days at ~5000
  const vals: number[] = [];
  for (let i = 0; i < 30; i += 1) vals.push(1000 + (i % 3) * 50);
  for (let i = 0; i < 30; i += 1) vals.push(5000 + (i % 3) * 50);
  const queue = fillDays('2026-01-01', vals, 'srcA');
  const r = buildDailyTokenFryzlewiczWbsMeanSegmentation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.mChangepoints >= 1, `expected >=1 CP, got ${row.mChangepoints}`);
  assert.ok(
    row.maxAbsCusum > row.threshold,
    `maxAbsCusum ${row.maxAbsCusum} should exceed threshold ${row.threshold}`,
  );
  // segments should partition the full tenure
  let lenSum = 0;
  for (const s of row.segments) lenSum += s.length;
  assert.equal(lenSum, row.nTenureDays);
});

test('wbs: stationary series yields m=0 and meanHomogeneity=1', () => {
  // alternating low-noise series with no mean shift
  const vals: number[] = [];
  for (let i = 0; i < 50; i += 1) vals.push(1000 + (i % 5) * 10);
  const queue = fillDays('2026-01-01', vals, 'srcS');
  const r = buildDailyTokenFryzlewiczWbsMeanSegmentation(queue, {
    generatedAt: GEN,
    cZeta: 2.0, // make threshold harder
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.mChangepoints, 0);
  assert.equal(row.tauStar.length, 0);
  assert.equal(row.tauStarDays.length, 0);
  assert.equal(row.meanRangeRatio, 1);
  assert.equal(row.meanHomogeneity, 1);
  assert.equal(row.segments.length, 1);
  assert.equal(row.segments[0]!.length, row.nTenureDays);
});

test('wbs: deterministic across runs (same seed, M, input)', () => {
  const vals: number[] = [];
  for (let i = 0; i < 40; i += 1) vals.push(i < 20 ? 500 : 3000);
  const queue = fillDays('2026-01-01', vals, 'srcD');
  const a = buildDailyTokenFryzlewiczWbsMeanSegmentation(queue, {
    generatedAt: GEN,
  });
  const b = buildDailyTokenFryzlewiczWbsMeanSegmentation(queue, {
    generatedAt: GEN,
  });
  assert.deepEqual(a.sources[0]!.tauStar, b.sources[0]!.tauStar);
  assert.equal(a.sources[0]!.maxAbsCusum, b.sources[0]!.maxAbsCusum);
});

test('wbs: filters drop short tenure', () => {
  const queue = fillDays(
    '2026-01-01',
    [1500, 1500, 1500, 1500, 1500],
    'srcShort',
  );
  const r = buildDailyTokenFryzlewiczWbsMeanSegmentation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('wbs: zero-variance source dropped', () => {
  const vals: number[] = new Array(30).fill(1500);
  const queue = fillDays('2026-01-01', vals, 'srcConst');
  const r = buildDailyTokenFryzlewiczWbsMeanSegmentation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('wbs: tauStarDays correspond to firstActiveDay + tau', () => {
  const vals: number[] = [];
  for (let i = 0; i < 60; i += 1) vals.push(i < 25 ? 800 : 6000);
  const queue = fillDays('2026-02-15', vals, 'srcT');
  const r = buildDailyTokenFryzlewiczWbsMeanSegmentation(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.firstActiveDay, '2026-02-15');
  for (let j = 0; j < row.tauStar.length; j += 1) {
    const tau = row.tauStar[j]!;
    const expected = new Date(
      Date.parse('2026-02-15T00:00:00.000Z') + tau * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    assert.equal(row.tauStarDays[j], expected);
  }
});

test('wbs: segments cover full tenure with no overlap', () => {
  const vals: number[] = [];
  for (let i = 0; i < 90; i += 1) {
    if (i < 30) vals.push(500);
    else if (i < 60) vals.push(3000);
    else vals.push(8000);
  }
  const queue = fillDays('2026-01-01', vals, 'srcCov');
  const r = buildDailyTokenFryzlewiczWbsMeanSegmentation(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  // segments must be tStart-ordered and contiguous
  for (let j = 1; j < row.segments.length; j += 1) {
    assert.equal(row.segments[j]!.tStart, row.segments[j - 1]!.tEndExclusive);
  }
  assert.equal(row.segments[0]!.tStart, 0);
  assert.equal(
    row.segments[row.segments.length - 1]!.tEndExclusive,
    row.nTenureDays,
  );
});

test('wbs: meanRangeRatio = 1 iff mChangepoints = 0', () => {
  const vals: number[] = [];
  for (let i = 0; i < 50; i += 1) vals.push(2000 + (i % 3) * 5);
  const queue = fillDays('2026-01-01', vals, 'srcFlat');
  const r = buildDailyTokenFryzlewiczWbsMeanSegmentation(queue, {
    generatedAt: GEN,
    cZeta: 5.0,
  });
  const row = r.sources[0]!;
  assert.equal(row.mChangepoints, 0);
  assert.equal(row.meanRangeRatio, 1);
});

test('wbs: top cap correctly drops surplus', () => {
  const queues: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    const vals: number[] = [];
    for (let i = 0; i < 30; i += 1) vals.push(1000 + s * 200 + (i % 2) * 50);
    queues.push(...fillDays('2026-01-01', vals, `s${s}`));
  }
  const r = buildDailyTokenFryzlewiczWbsMeanSegmentation(queues, {
    top: 3,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 3);
  assert.equal(r.droppedTopSources, 2);
});

test('wbs: source filter restricts and surfaces droppedSourceFilter', () => {
  const q1 = fillDays(
    '2026-01-01',
    Array.from({ length: 30 }, (_, i) => 1000 + (i % 4) * 100),
    'keep',
  );
  const q2 = fillDays(
    '2026-01-01',
    Array.from({ length: 30 }, (_, i) => 1000 + (i % 4) * 100),
    'drop',
  );
  const r = buildDailyTokenFryzlewiczWbsMeanSegmentation([...q1, ...q2], {
    source: 'keep',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.ok(r.droppedSourceFilter > 0);
});

test('wbs: invariant: m = number of segments - 1', () => {
  const vals: number[] = [];
  for (let i = 0; i < 80; i += 1) {
    if (i < 25) vals.push(500);
    else if (i < 50) vals.push(3000);
    else vals.push(7000);
  }
  const queue = fillDays('2026-01-01', vals, 'srcInv');
  const r = buildDailyTokenFryzlewiczWbsMeanSegmentation(queue, {
    generatedAt: GEN,
  });
  for (const row of r.sources) {
    assert.equal(row.segments.length, row.mChangepoints + 1);
    assert.equal(row.tauStar.length, row.mChangepoints);
    assert.equal(row.tauStarDays.length, row.mChangepoints);
  }
});

test('wbs: invariant: meanShiftSpread >= max|meanShiftRel|', () => {
  const vals: number[] = [];
  for (let i = 0; i < 70; i += 1) vals.push(i < 35 ? 1200 : 4800);
  const queue = fillDays('2026-01-01', vals, 'srcShift');
  const r = buildDailyTokenFryzlewiczWbsMeanSegmentation(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  let maxAbs = 0;
  for (const seg of row.segments) {
    const a = Math.abs(seg.meanShiftRel);
    if (a > maxAbs) maxAbs = a;
  }
  assert.equal(row.meanShiftSpread, maxAbs);
  // meanHomogeneity = 1 - spread / (spread + 1)
  const expected = 1 - maxAbs / (maxAbs + 1);
  assert.ok(Math.abs(row.meanHomogeneity - expected) < 1e-12);
});

test('wbs: sort=tokens orders descending by totalTokens', () => {
  const queues: QueueLine[] = [];
  const sizes = [5000, 1500, 12000];
  for (let s = 0; s < sizes.length; s += 1) {
    const per = sizes[s]! / 30;
    const vals: number[] = [];
    for (let i = 0; i < 30; i += 1) vals.push(per + (i % 4) * 5);
    queues.push(...fillDays('2026-01-01', vals, `src${s}`));
  }
  const r = buildDailyTokenFryzlewiczWbsMeanSegmentation(queues, {
    sort: 'tokens',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i]!.totalTokens <= r.sources[i - 1]!.totalTokens,
      'tokens sort not descending',
    );
  }
});
